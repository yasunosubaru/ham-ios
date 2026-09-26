# End-to-end testing

## Scope

The iOS and Android release suites boot the standalone `Ham` production entry
and check its home, course, score, and calculator screens with stable
accessibility IDs. The old component/course-import flows remain in the
`ios-debug-legacy` and `android-debug-legacy` directories as historical examples
for a future dedicated debug target. Neither suite validates the private
`ham-ios` / `ham-android` hosts or a signed TestFlight artifact.

Flows run against a **Release** build, so the bundle is embedded in the app and
no Metro server is involved. See [Build Release, not Debug](#build-release-not-debug).

The production screens use stable test IDs, so the flows do not depend on the
simulator's language. The older debug-shell flows are not run by CI; their
component-specific assertions are documented in the historical flow files.

## Prerequisites

### Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH":"$HOME"/.maestro/bin
maestro --version
```

### Build Release, not Debug

This matters more than anything else here, and it is not obvious.

In a Debug build, the app does not contain a JS bundle — it expects a Metro
server to serve one:

- **iOS**: `react-native-xcode.sh` skips bundling for Debug + Simulator builds
  ("Skipping bundling in Debug for the Simulator since the packager bundles for
  you"), and `AppDelegate.mm`'s `#if DEBUG` branch returns
  `jsBundleURLForBundleRoot`, i.e. a `localhost:8081` URL.
- **Android**: the RN Gradle plugin skips bundling for `debuggableVariants`
  (default: `debug`), and `RNContainer.kt` runs with
  `useDevSupport = BuildConfig.DEBUG`, also looking for a packager.

So a Debug app with no Metro running shows a **blank screen** — every
`assertVisible` times out, and the failure looks like a flow problem rather
than a missing bundle.

Build Release instead. Release embeds `main.jsbundle` / the release APK bundle
and needs no packager at all:

```bash
# iOS
pnpm embed
cd ios && pod install && cd ..
xcodebuild -workspace ios/ham-rn.xcworkspace -scheme ham-rn \
  -sdk iphonesimulator -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -derivedDataPath ios/build/e2e build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""

# Android — the release APK embeds the production `index.js` entry.
# It is signed with the checked-in debug keystore for CI smoke purposes.
pnpm embed
cd android && ./gradlew assembleRelease --no-daemon
```

`pnpm ios` / `pnpm android` build **Debug** and are not what you want here.

Maestro drives an already-installed app; it does not build or install one.
Install the Release build yourself before running flows.

### CI runners, and the Android ABI trap

The two e2e jobs deliberately run on different operating systems:

- **iOS on `macos-15`** — the simulator needs Xcode.
- **Android on `ubuntu-latest`** — Linux runners expose `/dev/kvm`, so the
  emulator gets hardware acceleration. macOS runners have none, and the same
  emulator falls back to software rendering and Maestro times out waiting for
  the app. The workflow enables KVM group permissions before the emulator
  starts; without that step the runner user cannot open `/dev/kvm`.

On Android the **APK's ABI must match the emulator**. `android/gradle.properties`
sets `reactNativeArchitectures=arm64-v8a`, so `assembleRelease` produces an
arm64-only APK by default. Installing that on the x86_64 emulator CI used to
run crashed the app in `MainApplication.onCreate`:

```
SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so
```

The app dies before any RN content renders, so every assertion times out and
the failure looks like a flow problem rather than an ABI mismatch. The workflow
passes `-PreactNativeArchitectures=x86_64` to override the gradle property for
the e2e build only, leaving the arm64 default intact for the other Android
workflows. If you ever switch the emulator to `arm64-v8a`, drop the override.

## Running

CI runs `.maestro/ios/production-smoke.yaml` and
`.maestro/android/production-smoke.yaml` for the standalone release entries.
The old debug-shell flows were moved to `ios-debug-legacy/` and
`android-debug-legacy/` and are historical examples only.

| Flow                            | What it covers                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ios/production-smoke.yaml`     | The iOS production bundle opens the home, course, score, and calculator routes by stable accessibility IDs. |
| `android/production-smoke.yaml` | The Android production APK opens the same four routes without CAS credentials.                              |

The production flows require no CAS credentials and only assert that each route
opens. The historical course-import flows require their dedicated debug target;
see the legacy directories rather than running them against the release app.

```bash
# iOS (simulator must already be running, Release app already installed)
maestro test .maestro/ios/

# Android (emulator must already be running, release APK already installed)
maestro test .maestro/android/

# A single flow
maestro test .maestro/ios/production-smoke.yaml
```

Pass `--device <udid>` to target a specific simulator; without it Maestro picks
one, which is fragile when several are booted.

```bash
maestro test --device "$(xcrun simctl list devices | grep -i booted | grep -oE '[0-9A-F-]{36}' | head -1)" \
  .maestro/ios/production-smoke.yaml
```

Set `MAESTRO_DRIVER_STARTUP_TIMEOUT` if the app takes longer than the default
to boot on a cold simulator.

## Writing flows

### Use stable accessibility IDs

The standalone production flow uses IDs such as `course-schedule`, `scores`,
`calculator`, and `back-button`; these do not depend on the simulator language.
The older Android debug-shell flows still use hardcoded shell labels and
Chinese fixture titles, so they are kept separate from the iOS production job.

New production flows should prefer IDs exposed by `testID` or
`accessibilityLabel` over translated text.

### Prefer `id` over `text` where the production screen exposes it

The production flow uses `testID` together with a stable `accessibilityLabel`
where iOS needs an accessibility identifier. Text matching remains brittle
against copy changes, so new production flows should prefer `id:`.

### `assertVisible` has no timeout — use `extendedWaitUntil` to wait

`assertVisible` takes **only a selector**. There is no `timeout` property; the
command retries for a fixed ~7 seconds and then fails. This is easy to get
wrong, and the error is unhelpful:

```
Unknown Property: timeout at .maestro/ios/production-smoke.yaml:-1:-1
```

7 seconds is not reliably enough for a cold RN bundle launch, so anything that
has to wait for RN content should use `extendedWaitUntil`, which does take a
`timeout`:

```yaml
- extendedWaitUntil:
    visible: '计算机学院综测计算（F2）'
    timeout: 60000 # iOS: 60s; use 120s on Android, emulators are slower
```

Use `assertVisible` for things that are already on screen, and
`extendedWaitUntil` for anything that appears after a tap or a bundle launch.

On Android, `extendedWaitUntil` also scrolls while searching, so it replaces an
explicit `scrollUntilVisible` for elements below the fold.

Longer timeouts make each step more patient — but they do **not** fix the
simulator degrading across repeated runs. See
[Known instability](#known-instability-across-repeated-runs).

### Do not rely on pinning the simulator language

```bash
xcrun simctl spawn booted defaults write -g AppleLanguages '("en")'
```

This sets the OS-level language, but it does **not** change what i18next picks:
`NativeCommonModule.getLocale()` ignores it. Do not add assertions that depend
on it working. (CI no longer runs this step at all.)

## What is worth testing

The production smoke flow should stay credential-free and limited to stable
route-level checks: it can verify that the home, CAS gate, score gate, and
calculator open without crashing. It must not assert private course or score
content, nor depend on a particular device locale.

The component-level course-import cases below are historical documentation for
the removed debug shell. They are retained so a future dedicated debug target
can restore the coverage without re-inventing the fixture design.

### Testing the legacy course flow

The flows have no credentials for `cas.whu.edu.cn` and cannot fabricate a CAS
session, so they cannot drive the real fetch. They also cannot intercept XHR —
Maestro has no network stubbing — so the fixture has to live inside the bundle.

`RNFetchCourseViewE2E` (registered in `index.debug.js`, used by the Android
debug shell) installs `src/e2e/courseFixture.ts`, which patches `global.fetch` to
answer just two URLs and delegates everything else to the original. Every other
step is production code: real `loginEducation`, real `getCourseList`, real
`parseResponse` and `toNativeCoursePairing`, real notice. The fixture's payload
uses the education system's own shapes, including a week string the parser
cannot read (`全周`) and a course with no schedule at all — the two cases the
notice exists for.

#### One entry per branch

The import has six ways to end and they are distinguished **only** by what the
server returns, so a flow cannot reach them by interacting with the UI — it has
to launch a different canned payload. That means one AppRegistry entry per
branch, each with its own row in the debug shell:

| Entry                  | Payload                                | The branch it puts the machine in                  |
| ---------------------- | -------------------------------------- | -------------------------------------------------- |
| `RNFetchCourseViewE2E` | 2 parse, 20 do not                     | Notice appears; acknowledging commits a timetable. |
| `...E2EClean`          | 2 parse, 0 do not                      | No notice; the import completes on its own.        |
| `...E2EAllFailed`      | 0 parse, 20 do not                     | Notice appears; acknowledging reports an error.    |
| `...E2EEmpty`          | no courses at all                      | No notice; an empty timetable is a success.        |
| `...E2ELoginFailed`    | CAS answers without the success marker | Fails before any course is parsed.                 |

`src/e2e/courseImportEntries.tsx` builds the Android debug entries. The
`__tests__/App.test.tsx` suite checks that the production `index.js` contains
only `Ham` and that the separate `index.debug.js` retains the E2E registrations;
it does not assert the removed iOS Swift demo shell.

#### The verdict is read from the label, not the text

**On iOS an `accessibilityLabel` replaces a `<Text>`'s content in the
accessibility tree.** Maestro reads that tree and nothing else, so once the
verdict `Text` carried `accessibilityLabel="courseImportVerdict"`, the words
`success` and `failed` were no longer visible to it — despite being rendered,
correctly, on screen. The flow waited for the label (which passed) and then
failed `assertVisible: 'success'`, with the verdict sitting there the whole
time.

So the probe puts the outcome _in_ the label:

| Rendered text | `accessibilityLabel`          | What Maestro can match on iOS |
| ------------- | ----------------------------- | ----------------------------- |
| `success`     | `courseImportVerdict-success` | `courseImportVerdict-success` |
| `failed`      | `courseImportVerdict-failed`  | `courseImportVerdict-failed`  |
| `pending`     | `courseImportPending`         | `courseImportPending`         |

Android is unaffected and needs none of this: it selects by `id`, because the RN
`testID` does surface there as a resource-id, and on Android a label does not
displace the text. That asymmetry is why this failure was iOS-only — android
passed 4/4 while ios failed 1/4 on the same commit.

The general form of the trap: **never put an `accessibilityLabel` on a `<Text>`
whose content a flow has to assert.** If a flow must read the text, leave the
label off and let iOS expose the content. If a flow must select the node by
label, put everything the flow needs _in_ the label.

`__tests__/e2e/courseFixture.test.ts` pins the fixture's shape, because a
fixture that stopped producing ignored courses would leave the flow asserting
nothing while still passing.

#### Seeing what the host was told

`EducationModule.onGetCourseList` is the only signal the host gets, and in the
debug shell it ends in `Log.i` / `NSLog` — which Maestro cannot read. So the
e2e entries also mount `src/e2e/courseImportProbe.tsx`, which wraps that module
method, records what it was called with, and renders `success` or `failed`.
Without it a flow could see the notice appear but never learn what the import
decided, and the four non-notice branches would be indistinguishable.

The verdict words are deliberately not i18next copy — see the rules below.

The flows assert the verdict through its `accessibilityLabel`
(`courseImportVerdict-success` / `courseImportVerdict-failed`), not through the
text on screen. See
[The verdict is read from the label, not the text](#the-verdict-is-read-from-the-label-not-the-text)
for why.

#### The probe sits below the course screen, and that is load-bearing

At the top of the screen the probe rendered correctly and
`adb shell uiautomator dump` listed it, but Maestro still judged it not
visible: on this device the status bar occupies y 0–63 and the probe landed at
y 10–47, i.e. underneath it. Maestro treats an occluded node as absent;
`uiautomator dump` does not, which is why the two disagreed and why the symptom
looked like the import never reported anything.

If you move the probe, keep it clear of the status bar and of the notice's own
layout.

Two rules for assertions in these flows, both verified rather than assumed:

- **Never select by `testID`.** RN's `testID` does not reach iOS's accessibility
  tree, so Maestro cannot see it. Anything a flow must select needs an
  `accessibilityLabel`; the dialog and its button carry them for this reason.
  **But a label on a `<Text>` replaces its content in that tree** — see
  [The verdict is read from the label, not the text](#the-verdict-is-read-from-the-label-not-the-text).
  Putting one on text a flow has to read is how this flow broke.
- **Never assert i18next copy.** The language comes from
  `NativeCommonModule.getLocale()`, which reads the device locale and ignores
  `defaults write -g AppleLanguages`. The flows assert on course names, which
  come from the fixture, not from a translation.

`__tests__/e2e/courseFixture.test.ts` pins the fixture's shape, because a
fixture that stopped producing ignored courses would leave the flow asserting
nothing while still passing.

### Why smoke does not navigate back

`smoke.yaml` used to tap into each registered screen, press back, and assert the
shell's list was still there. That assertion failed, and the flow could not go
in CI: after pushing any RN screen and going back, the native list renders
empty. This was reproduced with `RNCommon` alone, which makes no network calls
at all, so it is not a network or login problem — the RN container does not come
back cleanly after being popped.

So the flow reaches each screen with a fresh `launchApp` instead of navigating
back. That keeps the actual check — the entry boots with the embedded bundle —
without depending on a shell behaviour that is broken. Fixing the shell is the
real fix, and is still outstanding.

Deep behavioural coverage belongs in the Jest suite (`pnpm test`), which can
mock the native modules — e2e cannot. Use e2e for "the bundle boots and the
screen renders in a real native container", and Jest for everything else.

## Known instability across repeated runs

**The flows pass on a settled device, but degrade when you run them repeatedly.**
Measured on a local macOS simulator, running the same flow back to back with no
cooldown:

```
run1: 5/5 steps COMPLETED
run2: 2/5
run3: 3/5
run4: 0/5
-- ~20s cooldown --
single run: 5/5 COMPLETED
```

This does **not** affect CI: each job runs exactly once on a fresh runner,
which is the settled-device case. `continue-on-error` was set initially
because of the local numbers above; it was removed once CI proved stable. If
the jobs start failing intermittently on CI, investigate rather than
re-adding `continue-on-error` — a non-blocking job is one nobody has to act on.

### The XCUITest driver sometimes never starts

A distinct failure mode, seen once on CI: Maestro logs

```
[Failed] Perform XCUITest driver status check on <udid>,
exception: java.net.ConnectException: Failed to connect to /127.0.0.1:<port>
```

repeated for ~2 minutes and then the job fails. **No flow runs at all** — there
are no `[Passed]`/`[Failed]` lines for individual flows, and the Maestro
artifact is uploaded by the `if: failure()` step rather than by a real
assertion. The driver never came up, so this says nothing about the app.

It is infrastructure, not a regression: re-running the same job on the same
commit passed with 3/3 flows. Check whether any flow ran before reading it as a
product failure — a log with no per-flow results is a driver problem, not a
broken screen.

Two failure shapes when running locally, both environment-level, not flow bugs:

- `launchApp` fails outright with
  `FBSOpenApplicationServiceErrorDomain, code=4` — the simulator cannot open the
  app at all. Note this is also the error you get when the app was never
  installed; check `simctl get_app_container booted <bundle-id>` before
  assuming it is simulator wear.

What is _not_ the cause: it is not a network problem, and it is not the wait
timeout. `extendedWaitUntil` with a 60s timeout does not prevent it. Repeated
cold launches of an RN app is what wears the simulator down. (An earlier claim
in this file that timeouts fixed the flake was wrong — that measurement had a
buggy pass/fail check. The data above supersedes it.)

> Note the `code=4` error has two distinct causes with the same message — app not
> installed, or simulator degraded. They are easy to confuse. Check install first:
> it is the cheaper one to rule out.

## CI setup, and the two traps that cost the most time

Both jobs failed when first added, for two separate reasons worth recording,
because neither error message pointed at the actual cause:

1. **The app was never installed.** `xcodebuild build` produces a `.app` and
   does not install it, and `simulator-action` only boots the device. Maestro
   then failed at `launchApp` with `FBSOpenApplicationServiceErrorDomain
code=4`, which reads like a launch bug. Fixed with an explicit
   `xcrun simctl install <udid> <app>` step, and `--device <udid>` on Maestro
   so it targets that device instead of resolving `booted`.

2. **The Android APK ABI did not match the emulator.** `gradle.properties` sets
   `reactNativeArchitectures=arm64-v8a`, so `assembleRelease` produced an
   arm64-only APK. Installing it on the x86_64 emulator crashed in
   `MainApplication.onCreate` with `SoLoaderDSONotFoundError: couldn't find DSO
to load: libreactnative.so`, before any RN content rendered, so every
   assertion timed out. Fixed with `-PreactNativeArchitectures=x86_64`.

Also: the concurrency group must include `github.job`, or the two jobs share
one group and whichever starts second cancels the first — both reported
`cancelled` after ~9m, before Maestro ever ran.

Practically:

- Run a flow once, on a settled device, and treat that result as meaningful.
- If you need several runs, let the device cool down between them. Do not read a
  run that follows another immediately.
- If `launchApp` fails, check the app is actually still installed
  (`xcrun simctl get_app_container booted <bundle-id>`). Repeated runs can drop
  it from the device; reinstall, or shut the simulator down and boot it again
  before retrying.
- If `simctl list` shows a device as `Booted` but `get_app_container` resolves
  to a different device UDID, the simulator's state is confused. `killall -9 Simulator`,
  `xcrun simctl shutdown all`, then boot one device explicitly and pass
  `--device <udid>` to Maestro rather than relying on `booted`.

## Troubleshooting

**Every `assertVisible` times out and the screen is blank.** You are running a
Debug build with no Metro server. Debug builds contain no JS bundle on either
platform — see
[Build Release, not Debug](#build-release-not-debug). Confirm Metro really is
not masking this: `lsof -nP -iTCP:8081 -sTCP:LISTEN`. If something is listening
on 8081, a stale packager may be feeding a Debug app, which hides the problem
locally and guarantees a CI failure.

**`maestro test` hangs on launch.** The app is not installed, or the last
build predates your changes. Rebuild and reinstall the Release build, then
retry.

**The app runs fine by hand but the flow cannot find any text.** Stale app on
the device. `xcrun simctl uninstall booted <bundle-id>`, reinstall, retry.
Maestro attaches to whatever is installed and will not reinstall for you.

**Text assertions fail on iOS but pass on Android** (or vice versa). The two
shells use different navigation stacks — SwiftUI `NavigationLink` on iOS and
Compose Navigation on Android — so timing and scroll behaviour differ. Add an
`assertVisible` for the home screen before tapping through.

**iOS: RN `testID` is not visible to Maestro.** Maestro reads the native
accessibility tree, and on iOS React Native's `testID` does not surface there.
Either match on text, or set `accessibilityLabel` on the component.

**Android: elements need scrolling into view.** Maestro scrolls automatically
on iOS; on Android, add an explicit `scrollUntilVisible` for anything below the
fold.
