import { promises as fs } from 'fs';
import * as path from 'path';

import { ExecUtil } from '../../module/boot/src/exec';
import { FsUtil } from '../../module/boot/src/fs';
import { FrameworkUtil } from '../../module/boot/src/framework';

const ROOT = FsUtil.resolveUnix(__dirname, '..', '..'); // Move up from ./bin folder;
const MOD_ROOT = `${ROOT}/module`;
const COMMON = ['test', 'doc', 'cli'].map(m => ({ type: 'dev' as const, file: `${MOD_ROOT}/${m}`, dep: `@travetto/${m}` }));
const DEP_TYPES = ['dev', 'prod', 'opt'] as const;

/**
 * Log message around async op
 */
function withMessage(start: string, fn: Promise<any> | (() => Promise<any>), done?: string) {
  process.stdout.write(`${start} ... `);
  return ('call' in fn ? fn() : fn).then(x => process.stdout.write(`${(typeof x === 'string' ? x : done) ?? 'done'}.\n`));
}

/**
 * Take a monorepo module, and project out symlinks for all necessary dependencies
 * @param root
 */
async function finalizeModule(root: string) {
  const pkg = `@travetto/${path.basename(root)}`;
  // Fetch deps
  const deps = await FrameworkUtil.resolveDependencies({ root, types: DEP_TYPES });

  // Setup common on every module
  for (const sub of COMMON) {
    const resolved = (await FrameworkUtil.resolveDependencies({ root: sub.file, types: DEP_TYPES }))
      .map(k => ({ ...k, type: 'dev' as const }));
    deps.push(sub, ...resolved);
  }

  let links = 0;
  await FsUtil.mkdirp(`${root}/node_modules/@travetto`);
  for (const { dep, file } of deps.filter(d => d.dep !== pkg && d.dep.startsWith('@travetto'))) {
    const tgt = `${root}/node_modules/${dep}`;
    if (!(await FsUtil.exists(tgt))) {
      await FsUtil.symlink(await fs.realpath(file), tgt);
      links += 1;
    }
  }

  await FsUtil.mkdirp(`${root}/node_modules/.bin`);
  await FsUtil.symlink(`${MOD_ROOT}/cli/bin/travetto.js`, `${root}/node_modules/.bin/trv`);
  await FsUtil.symlink(`${MOD_ROOT}/cli/bin/travetto.js`, `${root}/node_modules/.bin/travetto`);
  return `finalized ${links} linked`;
}

/**
 * Main Entry point
 */
export async function run() {
  // Init lerna
  await withMessage('Lerna clean', ExecUtil.spawn('npx', ['lerna', 'clean', '--yes'], { shell: true }).result);
  await withMessage('Lerna bootstrap', ExecUtil.spawn('npx', ['lerna', 'bootstrap', '--hoist'], { shell: true }).result);

  // Clear out package-lock
  try {
    await fs.unlink(`${ROOT}/package-lock.json`);
  } catch (e) { }

  await withMessage('vscode-plugin install', async () => {
    const tgt = `${ROOT}/related/vscode-plugin`;
    await ExecUtil.spawn('npm', ['i'], { shell: true, cwd: tgt }).result.catch(err => { });
    await FsUtil.unlinkRecursive(`${tgt}/node_modules/@travetto/boot`, true);
    await FsUtil.copyRecursiveSync(`${MOD_ROOT}/boot`, `${tgt}/node_modules/@travetto/boot`);
  });

  const packages = (await ExecUtil.spawn(`npx`, ['lerna', 'ls', '-p', '-a']).result).stdout.split(/\n/);

  // Finalize all modules
  for (const pkg of packages.filter(x => !!x && x.includes(FsUtil.cwd)).map(x => FsUtil.resolveUnix(x))) {
    await withMessage(`@travetto/${path.basename(pkg)}`, finalizeModule(pkg));
  }
}