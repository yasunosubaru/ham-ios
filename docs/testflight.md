# Standalone iOS / TestFlight build

This repository contains a React Native iOS host. The production entry point is
`index.js`, which registers only `Ham`; demo and E2E registrations live in the
separate `index.debug.js` entry and are not loaded by a Release archive.

## Local requirements

- macOS with Xcode and iOS 16 or newer
- Node 22 or newer
- pnpm 10.32.1
- CocoaPods 1.16.2

Install dependencies and generate the embedded score scripts:

```sh
pnpm install --frozen-lockfile
pnpm embed
cd ios
pod _1.16.2_ install --no-repo-update
cd ..
```

Open `ios/ham-rn.xcworkspace`, select the `ham-rn` scheme, and run a Debug build
on a simulator. A Debug build loads `index.debug.js` from Metro. A Release build
embeds the production `main.jsbundle` and needs no Metro server.

## TestFlight setup

This app intentionally uses the separate bundle identifier
`com.nowcent.ham.rn`. The Fastlane lane refuses the official `com.nowcent.ham`
bundle ID so an independently signed community build cannot accidentally replace
the production app.

Before the first upload:

1. Join the Apple Developer Program.
2. Register `com.nowcent.ham.rn` in Certificates, Identifiers & Profiles. If a
   different bundle ID is required, register that ID too and set the workflow
   variable described below.
3. Create a matching App Store Connect app record and complete its privacy and
   metadata fields.
4. Create an App Store Connect API key with the minimum role that can manage the
   app and upload builds (App Manager normally has both capabilities).
5. Configure the protected `testflight` GitHub Environment and its reviewers.

The GitHub Actions workflow `.github/workflows/ios-testflight.yml` expects these
repository variables:

- `IOS_DEVELOPMENT_TEAM` — the Apple Developer Team ID; keep this exact name
  because Fastlane also reads the corresponding `DEVELOPMENT_TEAM` environment
  variable when it generates export options;
- `IOS_BUNDLE_ID` — the registered standalone bundle ID.

For an Enterprise/in-house team, set the optional repository variable
`ASC_IN_HOUSE` to `true`; leave it unset for the normal App Store Connect
API.

It expects these repository secrets:

- `ASC_KEY_ID`;
- `ASC_KEY_ISSUER_ID`;
- `ASC_KEY_CONTENT` — either the complete PEM-formatted `.p8` key or its Base64
  encoding.

Run the workflow manually from the Actions tab. `version_name` must use the
numeric App Store form (for example `1.0.0`), and `build_number` must be a
positive integer higher than every build already uploaded for that version. The
job archives the app, exports an IPA, waits for App Store Connect processing,
and uploads the build with external distribution disabled. App Store Connect
internal testers can access an uploaded build after processing; the job never
adds the build to external testing or contacts external testers.

After processing, install the exact TestFlight build on a physical device and
smoke-test CAS login, course loading, score loading, and logout before deciding
whether a separate external-testing submission is appropriate.

The upload job is designed for a GitHub-hosted macOS runner. It writes the API
key to the runner temporary directory with mode `0600`, removes it in an
`always()` cleanup step, and uploads only the IPA and export summary as a build
artifact. It does not retain the `.xcarchive`, which can contain provisioning
metadata.

### Running Fastlane locally

Run the lane from any directory; the Fastfile resolves paths from the
repository root:

```sh
export ASC_KEY_ID=...
export ASC_KEY_ISSUER_ID=...
export ASC_KEY_PATH=/absolute/path/to/AuthKey.p8
# Only for an Enterprise/in-house team:
# export ASC_IN_HOUSE=true
export DEVELOPMENT_TEAM=...
export PRODUCT_BUNDLE_IDENTIFIER=com.nowcent.ham.rn
export MARKETING_VERSION=1.0.0
export CURRENT_PROJECT_VERSION=1
export RELEASE_NOTES='What to Test'
fastlane ios testflight
```

## Security boundary

The public repositories do not contain the production Ham account OAuth
service, QR confirmation API, private `ham-proto`, or `ham-backend-go`. The
standalone build therefore does not claim to implement those services. CAS
credentials stay inside the university WebView and are not sent across the
React Native bridge. The session cookie is stored in the iOS Keychain, request
credentials are redacted from logs, and education responses are not logged.
Course and score responses are rendered in memory and are not written to a
local database. The home screen provides an explicit logout action that clears the iOS Keychain
and platform cookie stores.

Do not add shared gateway tokens, OAuth client secrets, mTLS private keys, or
Hot Updater deployment credentials to this app or its repository.
