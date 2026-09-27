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
# node_modules is installed, never symlinked.
#
# Symlinking the long-lived checkout's copy was tried and is wrong: that tree
# drifts behind pnpm-lock.yaml, and Metro then fails to resolve a dependency the
# lockfile names -- "Module does not exist in the Haste module map" for
# @babel/runtime, with nothing in the message pointing at the symlink. A stale
# tree is a much worse failure than a slow install.
#
# pnpm's content-addressable store is what makes installing here cheap: with the
# lockfile unchanged it links from the local store and takes seconds, and it is
# the same store the build machine already has.
echo "  installing node dependencies"
(cd "$WORK" && pnpm install --frozen-lockfile) || { echo "  pnpm install failed"; exit 1; }

# Pods are reused when they still match, and installed when they do not.
#
# CocoaPods runs a build phase comparing Podfile.lock against
# Pods/Manifest.lock byte for byte, so a symlinked tree from a checkout with
# different dependencies fails the build with "[CP] Check Pods Manifest.lock"
# and nothing that names the cause. Comparing first turns a confusing failure
# into either a fast reuse or an honest install.
pods_src="$HOME/ham-rn/ios/Pods"
if [ -d "$pods_src" ] && [ -f "$WORK/ios/Podfile.lock" ] &&
   [ -f "$pods_src/Manifest.lock" ] &&
   cmp -s "$WORK/ios/Podfile.lock" "$pods_src/Manifest.lock"; then
  rm -rf "$WORK/ios/Pods"
  ln -s "$pods_src" "$WORK/ios/Pods"
else
  reason="no reusable tree"
  [ -d "$pods_src" ] && reason="Podfile.lock differs from its Manifest.lock"
  echo "  installing pods ($reason)"
  rm -rf "$WORK/ios/Pods"
  (cd "$WORK/ios" && pod install --no-repo-update) || { echo "  pod install failed"; exit 1; }
fi

# Not swallowed. `pnpm embed` generates the files the app reads at runtime, and
# a silent failure here used to surface much later as a screen with no data.
echo "  generating embedded data"
(cd "$WORK" && pnpm embed) || { echo "  pnpm embed failed"; exit 1; }

DERIVED="$WORK/ios/build/prepush"

# Ask the build system where the product lands rather than assuming.
#
# With -derivedDataPath set, products sit under that path; without it they go to
# the per-user DerivedData directory. Hardcoding either one is how a successful
# build gets reported as "Ham.app was not produced" -- which is what an earlier
# version of this script did, with a path left over from a different script.
settings="$(cd "$WORK/ios" && xcodebuild \
  -workspace ham-rn.xcworkspace \
  -scheme ham-rn \
  -sdk iphonesimulator \
  -configuration Release \
  -derivedDataPath "$DERIVED" \
  -showBuildSettings 2>/dev/null)"
products="$(printf '%s\n' "$settings" | awk -F' = ' '/^[[:space:]]*BUILT_PRODUCTS_DIR/ {print $2; exit}')"
product="$(printf '%s\n' "$settings" | awk -F' = ' '/^[[:space:]]*FULL_PRODUCT_NAME/ {print $2; exit}')"
if [ -z "$products" ] || [ -z "$product" ]; then
  echo "  could not read BUILT_PRODUCTS_DIR / FULL_PRODUCT_NAME from xcodebuild"
  exit 1
fi
APP_DIR="$products/$product"
echo "  product will be at $APP_DIR"

# --- build -----------------------------------------------------------------
echo "  building (unsigned Release, simulator)"
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
  # Print the end of the log rather than matching on error strings.
  #
  # A pattern list is the wrong tool: a Metro resolution failure, a CocoaPods
  # manifest mismatch and a compile error all announce themselves differently,
  # and the patterns that catch them also match thousands of characters of
  # compiler flags. The tail of the log is where the reason actually is, and it
  # is short enough to read. Lines are cut because a single xcodebuild line runs
  # to several thousand characters.
  echo "  --- 最后 40 行 ---"
  tail -40 "$LOG" | cut -c1-200 | sed 's/^/    /'
  echo "  --- 完整日志: $LOG ---"
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
