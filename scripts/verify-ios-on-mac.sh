#!/bin/bash
# Build, install and launch the iOS app on the Mac.
#
# Run as:  bash /tmp/ham-prepush/scripts/verify-ios-on-mac.sh
#
# The checkout is already in place: scripts/verify-prepush.mjs streams
# `git archive <sha>` over ssh and extracts it here first. Two things follow from
# that, both of them the point:
#
#   - What gets verified is the committed tree, not the working tree. A push
#     publishes the commit, so the commit is what has to build.
#   - This script is part of the archive it verifies, so it cannot disagree with
#     the tree it is checking.
#
# Builds under /tmp rather than a home directory: the compilation directory is
# baked into the Mach-O and into the Metro bundle's source URLs, which is how a
# published artifact ended up carrying someone's account name.
#
# Everything here answers one question: does the app build, install, and stay
# running. It does not check features and does not pretend to.
set -uo pipefail

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
# node and cocoapods are not on the default PATH here, and the gate needs both.
# Globs rather than pinned version directories, so a ruby upgrade on the build
# machine does not turn into "pod: command not found" and a gate failure that
# has nothing to do with the code -- which is the kind that gets bypassed.
for extra in "$HOME"/.local/ruby-*/bin "$HOME"/.local/node/bin; do
  [ -d "$extra" ] && export PATH="$extra:$PATH"
done

SYNC_FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --work) WORK="${2:-$WORK}"; shift 2 ;;
    *) shift ;;
  esac
done

BUNDLE_ID="com.nowcent.ham.rn"
WORK=/tmp/ham-prepush
LOG=/tmp/ham-prepush-build.log

command -v node >/dev/null 2>&1 || { echo "  node not found on PATH" >&2; exit 1; }
command -v xcrun >/dev/null 2>&1 || { echo "  xcrun not found -- not macOS?" >&2; exit 1; }
command -v pod >/dev/null 2>&1 || {
  echo "  pod not found on PATH; searched: $PATH" >&2
  echo "  install cocoapods, or put it on PATH" >&2
  exit 1
}

# Pick a simulator and make sure it is running.
#
# Any available iPhone, not only a booted one: a gate that requires someone to
# open Xcode and press Run before it will answer is a gate that gets bypassed,
# and the whole point of putting it here was that it cannot be bypassed by
# forgetting. Booted wins when there is a choice, because it is faster.
UDID="${HAM_SIM_UDID:-}"
if [ -z "$UDID" ]; then
  UDID="$(xcrun simctl list devices -j 2>/dev/null | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  let booted = "", any = "";
  try {
    const devices = JSON.parse(s).devices;
    for (const list of Object.values(devices)) {
      for (const d of list) {
        if (!d.isAvailable) continue;
        if (!/iPhone/.test(d.name)) continue;
        if (d.state === "Booted") { booted = d.udid; break; }
        if (!any) any = d.udid;
      }
      if (booted) break;
    }
  } catch (e) { /* fall through to the empty result */ }
  console.log(booted || any);
});')"
fi
if [ -z "$UDID" ]; then
  echo "  no available iPhone simulator found. Install one in Xcode, or set HAM_SIM_UDID." >&2
  exit 1
fi

state="$(xcrun simctl list devices -j 2>/dev/null | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  try {
    const devices = JSON.parse(s).devices;
    for (const list of Object.values(devices))
      for (const d of list) if (d.udid === process.argv[1]) { console.log(d.state); return; }
  } catch (e) {}
  console.log("");
});' "$UDID")"

if [ "$state" != "Booted" ]; then
  echo "  booting $UDID"
  xcrun simctl boot "$UDID" 2>/dev/null
  xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1
fi
echo "  simulator: $UDID ($state -> booted)"

# --- dependencies ----------------------------------------------------------
# node_modules and Pods are the slow parts and do not change between pushes, so
# reuse the long-lived checkout's copies through symlinks rather than refetching
# them. The archive carries neither, since both are generated and gitignored.
#
# Reusing Pods means the pod xcconfig files still point at that checkout's
# paths, so this build is a *does it compile, install and run* check and not a
# clean one. That division is deliberate: the publishable artifact is built by
# CI, which does its own `pod install` on a runner and therefore carries no local
# path at all. A gate that did a fresh pod install on every push would cost
# minutes each time and would still not be checking the thing that matters,
# which is whether the app starts.
if [ -e "$HOME/ham-rn/node_modules" ]; then
  rm -rf "$WORK/node_modules"
  ln -s "$HOME/ham-rn/node_modules" "$WORK/node_modules"
else
  echo "  installing node dependencies (first run on this machine)"
  (cd "$WORK" && pnpm install --frozen-lockfile) || { echo "  pnpm install failed"; exit 1; }
fi

# Reuse the Pods tree only while it still matches the lockfile.
#
# CocoaPods runs a build phase that compares Podfile.lock against
# Pods/Manifest.lock, so a symlinked tree from a checkout with different
# dependencies fails the build with "Check Pods Manifest.lock" and nothing that
# points at the cause. Comparing first turns a confusing failure into either a
# fast reuse or an honest install.
pods_src="$HOME/ham-rn/ios/Pods"
reuse_pods=0
if [ -d "$pods_src" ] && [ -f "$WORK/ios/Podfile.lock" ] &&
   [ -f "$pods_src/Manifest.lock" ] &&
   cmp -s "$WORK/ios/Podfile.lock" "$pods_src/Manifest.lock"; then
  reuse_pods=1
fi

if [ "$reuse_pods" = "1" ]; then
  rm -rf "$WORK/ios/Pods"
  ln -s "$pods_src" "$WORK/ios/Pods"
else
  reason="no reusable tree"
  [ -d "$pods_src" ] && reason="Podfile.lock differs from its Manifest.lock"
  echo "  installing pods ($reason)"
  rm -rf "$WORK/ios/Pods"
  (cd "$WORK/ios" && pod install --no-repo-update) || { echo "  pod install failed"; exit 1; }
fi

(cd "$WORK" && pnpm embed) >/dev/null 2>&1 || echo "  (embed reported a problem, continuing)"

APP_DIR="$WORK/ios/build/Products/Release-iphonesimulator/Ham.app"
DERIVED="$WORK/ios/build/prepush"

# --- build -----------------------------------------------------------------
echo "  building (unsigned Release, simulator)"
TEAM="$(grep -oE 'DEVELOPMENT_TEAM = [A-Z0-9]{10};' "$WORK/ios/ham-rn.xcodeproj/project.pbxproj" 2>/dev/null |
        head -1 | sed -E 's/.*= ([A-Z0-9]{10});/\1/')"
# Unsigned on purpose: a signed build embeds the Apple Team ID, and this gate
# exists to check that the app runs, not to produce a distributable.
(cd "$WORK/ios" && xcodebuild \
  -workspace ham-rn.xcworkspace \
  -scheme ham-rn \
  -sdk iphonesimulator \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" \
  build ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  ) > "$LOG" 2>&1
code=$?
if [ $code -ne 0 ]; then
  echo "  BUILD FAILED (exit $code)"
  grep -E 'error:|Unable to resolve|BUILD FAILED' "$LOG" | head -12 | sed 's/^/    /'
  exit 1
fi
[ -d "$APP_DIR" ] || { echo "  $APP_DIR was not produced"; exit 1; }
echo "  built: $(find "$APP_DIR" -type f | wc -l | tr -d ' ') files"

# --- install and launch ----------------------------------------------------
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null
xcrun simctl install "$UDID" "$APP_DIR" || { echo "  INSTALL FAILED"; exit 1; }
echo "  installed"

pid_out="$(xcrun simctl launch "$UDID" "$BUNDLE_ID" 2>&1)" || {
  echo "  LAUNCH FAILED: $pid_out"; exit 1;
}
echo "  $pid_out"
sleep 12

# A pid is printed even when the app dies immediately afterwards -- a missing
# native module or a bad bundle gets that far -- so the process has to still be
# there afterwards. This is the check the whole script exists for.
if xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "$BUNDLE_ID"; then
  echo "  still running after 12s"
else
  echo "  PROCESS DIED after launch"
  xcrun simctl spawn "$UDID" log show --last 30s --style compact \
    --predicate 'processImagePath CONTAINS "Ham"' 2>/dev/null |
    grep -iE 'fatal|exception|terminat' | head -8 | sed 's/^/    /'
  exit 1
fi

fatal="$(xcrun simctl spawn "$UDID" log show --last 30s --style compact \
  --predicate 'processImagePath CONTAINS "Ham"' 2>/dev/null |
  grep -icE 'fatal|crash' || true)"
if [ "${fatal:-0}" -gt 0 ]; then
  echo "  crash lines in the log: $fatal"
  exit 1
fi
echo "  no crash lines"
echo "  OK"
