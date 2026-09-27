# Ham React Native

[![React Native](https://img.shields.io/badge/React%20Native-0.87-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Lint](https://github.com/yasunosubaru/ham-rn/actions/workflows/lint.yml/badge.svg)](https://github.com/yasunosubaru/ham-rn/actions/workflows/lint.yml)
[![Bundle Check](https://github.com/yasunosubaru/ham-rn/actions/workflows/compile-check.yml/badge.svg)](https://github.com/yasunosubaru/ham-rn/actions/workflows/compile-check.yml)
[![Android Build](https://github.com/yasunosubaru/ham-rn/actions/workflows/android-build.yml/badge.svg)](https://github.com/yasunosubaru/ham-rn/actions/workflows/android-build.yml)
[![iOS Build](https://github.com/yasunosubaru/ham-rn/actions/workflows/ios-build.yml/badge.svg)](https://github.com/yasunosubaru/ham-rn/actions/workflows/ios-build.yml)
[![iOS TestFlight](https://github.com/yasunosubaru/ham-rn/actions/workflows/ios-testflight.yml/badge.svg)](https://github.com/yasunosubaru/ham-rn/actions/workflows/ios-testflight.yml)
[![License](https://img.shields.io/github/license/yasunosubaru/ham-rn)](./LICENSE)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whu-ham/ham-rn/1-overview)

A React Native component monorepo for the Ham app, providing education-related features with over-the-air (OTA) hot update support.

## About this repository

A standalone, independently identified build of the Ham app, derived from
[`whu-ham/ham-rn`](https://github.com/whu-ham/ham-rn). That project is the
upstream and remains the source of the shared grade-embedding data this app
fetches at runtime; the two lines of provenance are kept separate on purpose.

| | |
|---|---|
| Upstream | [`whu-ham/ham-rn`](https://github.com/whu-ham/ham-rn) — read-only reference |
| This build | bundle ID `com.nowcent.ham.rn`, its own signing identity and release track |
| Shared history | 65 upstream commits, unchanged; this repository's work is a clean descendant of `main` |

What this build adds on top of upstream:

- A native iOS target and an Android target, both with their own bundle ID,
  rather than a component library with no app around it.
- Score query, grade entry and campus weather driven through the education
  system's own pages in a `WebView`, reading the XHR replies the page receives.
- Campus weather, from a real forecast API.
- Release engineering: Fastlane, a TestFlight workflow, an Android build
  workflow, a bundle-size check and a Maestro E2E suite.

### Positions this build holds to

- **No captcha is bypassed, anywhere.** The education system gates its score
  query behind an image captcha, and the app treats that as the university's
  call to make. The user solves it in the page; the app reads the result. The
  same position applies to the sports-venue staff interface.
- **No grade is ever written.** Grade entry reads what the page returns and
  submits nothing. A teacher cannot enter a mark through this app.
- **No password, student number, cookie or token is ever requested, stored in
  source, logged, or sent anywhere but the university's own login endpoint.**
  Field vocabulary is read out of the pages' own public scripts, and every reply
  is rendered by the field names the system itself uses — unlabelled fields are
  shown under their raw names rather than given an invented label.
- **Access control is not circumvented.** Where a system hides a private key as
  an access-control measure, this project does not reconstruct it, even though
  the pieces are recoverable.


## Features

- **Course Schedule** – Fetch and parse course schedules from the education system
- **Score Query** – Retrieve academic scores with structured parsing
- **Score Calculator** – GPA/weighted score calculation utilities
- **CAS Authentication** – Central Authentication Service login flow (including mobile login)
- **Hot Update** – OTA updates powered by [hot-updater](https://github.com/gronxb/hot-updater)
- **i18n** – Multi-language support (English, Chinese, Japanese)

## Tech Stack

- React Native 0.87 (New Architecture enabled)
- TypeScript
- Jotai (state management)
- i18next (internationalization)
- ESLint + Prettier (code quality)
- pnpm (package manager)

## Getting Started

### Prerequisites

- Node.js >= 20.19 (Node 22 recommended for RN 0.87)
- pnpm 10
- Xcode (for iOS)
- Android Studio (for Android)
- CocoaPods

### Installation

```bash
pnpm install
```

### iOS Setup

```bash
cd ios && pod _1.16.2_ install --no-repo-update && cd ..
```

### Running

```bash
# Start Metro bundler
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

### Linting

```bash
pnpm lint
```

### Testing

```bash
pnpm test
```

Runs the Jest suite with [React Native Testing Library](https://callstack.github.io/react-native-testing-library/).
`pnpm test` runs `pnpm embed` first, which generates the embedded
score-calculator scripts that the tests import.

Two things to know when adding tests:

- **Every `render` / `fireEvent` / `renderHook` call must be awaited.** They
  are async in RNTL v14. Without the `await`, `render` returns an empty
  object and the global `screen` throws
  "`render` function has not been called".
- **Assert on `testID`s, not on rendered text.** User-facing strings come
  from i18next and differ across `zh` / `en` / `ja`, so text assertions
  break whenever copy changes. Components take an optional `testID` prop for
  this; see `jest.setup.ts` for the globally stubbed native modules.

## Project Structure

```
src/
├── business/          # Business logic layer
│   ├── cas/           # CAS authentication
│   └── education/     # Education system (course, score, scorecalc)
├── components/        # React Native UI components
│   ├── cas/           # CAS login views
│   ├── education/     # Education-related views
│   └── scorecalc/     # Score calculator views
├── i18n/              # Internationalization resources
├── modules/           # Native module specs (Turbo Modules)
├── resources/         # Static assets (images, HTML)
└── utils/             # Shared utilities (color, request, UI)
```

## Standalone iOS / TestFlight

The production entry point is `index.js` (`Ham`). The former debug shell and
E2E registrations are not included in the application bundle. A standalone
build uses the separate bundle identifier `com.nowcent.ham.rn`; it does not
impersonate the official `com.nowcent.ham` record.

See [`docs/testflight.md`](./docs/testflight.md) for Apple Developer setup,
Fastlane, signing, and the manual TestFlight upload workflow. The upload
workflow requires an explicitly configured Team ID, Bundle ID, and App Store
Connect API key; those credentials are never stored in this repository.

## CI/CD

GitHub Actions workflows run on PRs to `main` and pushes to `main`:

- **Lint** – ESLint and TypeScript checks
- **Test** – Jest suite
- **Compile Check** – Production and debug Metro bundles for iOS and Android
- **Android Build** – Debug APK build verification
- **iOS Build** – Debug and unsigned Release simulator verification
- **iOS TestFlight Upload** – Manual signed archive and TestFlight upload

## License

ham-rn is [MIT licensed](./LICENSE).
