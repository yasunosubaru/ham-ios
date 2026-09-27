#!/usr/bin/env node
/**
 * The gate that runs before anything is pushed.
 *
 * The reason this exists: a commit reached a public repository twice in one
 * session carrying an author email that a history rewrite had just removed, and
 * the first time it shipped with the release renamed and the CI green. Nothing
 * about the change was wrong; the problem was that "did I verify?" lived in my
 * head rather than in the path. A push is the last moment where a mistake is
 * still cheap, and it is the moment most likely to be taken on its own.
 *
 * So the check runs at push time, on every push, and cannot be skipped by not
 * remembering to run it.
 *
 * Two tiers:
 *
 *   1. Always, on the pushing machine: types, lint, tests. About forty seconds,
 *      and it catches the large majority of what would otherwise be found by a
 *      reviewer or by CI a few minutes later.
 *
 *   2. When the pushed range touches anything the iOS app is built from, a real
 *      build on the Mac: compile, install on the simulator, launch, and check
 *      the process is still alive. A Windows machine cannot do this, which is
 *      exactly why it is a separate tier -- "it looks fine" is not the same
 *      claim as "it starts".
 *
 * Tier 2 needs an ssh host, read from HAM_MAC_HOST. It is not defaulted, and
 * deliberately not hardcoded: the host alias belongs to one person's ssh config
 * and this file is in a public repository. With the variable unset the gate
 * stops and says so, rather than quietly passing -- and HAM_SKIP_MAC_VERIFY=1
 * skips it explicitly, so "skipped" is always a decision someone made and can be
 * read in the push output, never an oversight.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const VERBOSE = process.env.HAM_VERBOSE === '1';

const say = message => process.stdout.write(`${message}\n`);
const step = message => say(`\n=== ${message} ===`);

/**
 * Runs a command and reports whether it passed.
 *
 * Output is captured rather than inherited, so a failing step shows its own
 * diagnostics instead of scrolling the gate's own progress past. The tail is
 * printed on failure, because "tsc failed" without the file and line is a dead
 * end.
 */
const run = (label, command, args, options = {}) => {
  say(`  ${label} ...`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    say(`  ✗ ${label}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    say(`  ✗ ${label} (exit ${result.status})`);
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (output) {
      const lines = output.split('\n');
      say(
        lines
          .slice(-25)
          .map(line => `      ${line}`)
          .join('\n'),
      );
    }
    return false;
  }
  if (VERBOSE && result.stdout) {
    say(
      result.stdout
        .trim()
        .split('\n')
        .map(line => `      ${line}`)
        .join('\n'),
    );
  }
  say(`  ✓ ${label}`);
  return true;
};

/** The commits about to be published, as `localSha remoteSha` from stdin. */
const readPushedRefs = () => {
  let input = '';
  try {
    input = readFileSync(0, 'utf8');
  } catch {
    return [];
  }
  return input
    .split('\n')
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length >= 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef,
      localSha,
      remoteRef,
      remoteSha,
    }));
};

/**
 * Files whose change could stop the iOS app from building or starting.
 *
 * Deliberately broad. A wrong classification costs an unnecessary five-minute
 * Mac build, which is much cheaper than the alternative: a narrow list that
 * misses `package.json` or a Metro config change lets a broken app through on
 * the reasoning that "it was only a config change".
 */
const IOS_RELEVANT = [
  /^src\//,
  /^index(\.debug)?\.js$/,
  /^app\.json$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^metro\.config\.js$/,
  /^babel\.config\.ts$/,
  /^tsconfig\.json$/,
  /^ios\//,
  /^scripts\//,
];

const touchesIos = (from, to) => {
  const range = from ? `${from}..${to}` : to;
  const result = spawnSync('git', ['diff', '--name-only', range], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout) return false;
  const files = result.stdout.split('\n').filter(Boolean);
  const relevant = files.filter(file => IOS_RELEVANT.some(re => re.test(file)));
  if (relevant.length) {
    say(`  ${relevant.length} 个文件可能影响 iOS 构建:`);
    relevant.slice(0, 12).forEach(file => say(`    ${file}`));
    if (relevant.length > 12) say(`    ... 还有 ${relevant.length - 12} 个`);
  }
  return relevant.length > 0;
};

/**
 * Builds, installs and launches on the Mac over ssh.
 *
 * Verifies the process survives rather than assuming it: an app that launches
 * and then dies on a missing native module still reports a pid, and that is the
 * failure this is here to catch.
 */
/**
 * Streams the committed tree to the Mac, then runs the verification script from
 * inside that tree.
 *
 * `git archive` rather than a copy of the working tree, for two reasons. A push
 * publishes the commit, so the commit is what has to build -- and a working tree
 * can differ from it by exactly the change most worth checking. And because the
 * script travels inside the archive, the thing doing the verifying is part of
 * the thing being verified, so the two cannot drift apart.
 *
 * The transfer is a pipe rather than a path. The pushing machine is Windows and
 * the build machine is macOS; they share no filesystem, and handing over a local
 * path is the obvious approach that does not work.
 */
const verifyOnMac = (host, sha) => {
  const archived = spawnSync('git', ['archive', '--format=tar', sha], {
    cwd: ROOT,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (archived.status !== 0) {
    say(`  ✗ git archive ${sha.slice(0, 12)} 失败`);
    return false;
  }
  const transfer = spawnSync(
    'ssh',
    [
      host,
      'rm -rf /tmp/ham-prepush && mkdir -p /tmp/ham-prepush && tar -x -C /tmp/ham-prepush',
    ],
    {input: archived.stdout, maxBuffer: 256 * 1024 * 1024},
  );
  if (transfer.status !== 0) {
    say(`  ✗ 传输到 ${host} 失败`);
    const err = String(transfer.stderr || '').trim();
    if (err) say(`      ${err.split('\n').slice(-5).join('\n      ')}`);
    return false;
  }
  say(`  已传输 ${sha.slice(0, 12)} 的已提交内容`);
  return run(
    `Mac 上构建 / 安装 / 启动 (${host})`,
    'ssh',
    [host, 'bash /tmp/ham-prepush/scripts/verify-ios-on-mac.sh'],
    {env: {...process.env, LANG: 'en_US.UTF-8'}},
  );
};

const refs = readPushedRefs();
const isDelete = refs.length > 0 && refs.every(r => r.localSha === '0' * 40);

say(`Ham pre-push gate  (${path.basename(ROOT)}, ${refs.length} ref(s))`);
if (isDelete) {
  say('  这是一次删除推送，跳过验证。');
  process.exit(0);
}

step('本地检查');
const localOk =
  run('类型检查 (tsc --noEmit)', 'npx', ['tsc', '--noEmit']) &&
  run('静态检查 (eslint)', 'npx', ['eslint', '.']) &&
  run('测试 (jest)', 'npx', ['jest', '--ci']);
if (!localOk) {
  say('\n拒绝推送：本地检查未通过。');
  process.exit(1);
}

const relevant = refs.some(r => touchesIos(r.remoteSha, r.localSha));
if (!relevant) {
  say('\n本次推送不涉及 iOS 构建，跳过 Mac 验证。');
  process.exit(0);
}

step('Mac 验证（iOS 相关改动）');
if (process.env.HAM_SKIP_MAC_VERIFY === '1') {
  say('  HAM_SKIP_MAC_VERIFY=1 —— 显式跳过。这是有人做的决定，不是遗漏。');
  process.exit(0);
}
const host = process.env.HAM_MAC_HOST;
if (!host) {
  say('  HAM_MAC_HOST 未设置，无法验证 iOS 构建。');
  say('  本地机器不是 macOS，"看起来没问题" 不等于 "能启动"。');
  say('  两种做法：');
  say('    设置 HAM_MAC_HOST 后重试，或');
  say('    HAM_SKIP_MAC_VERIFY=1 显式跳过（跳过会被记录在推送输出里）');
  process.exit(1);
}
if (!verifyOnMac(host, refs[0].localSha)) {
  say('\n拒绝推送：Mac 上构建 / 安装 / 启动未通过。');
  process.exit(1);
}

say('\n全部通过，可以推送。');
