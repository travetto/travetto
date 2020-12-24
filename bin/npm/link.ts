import { promises as fs } from 'fs';
import * as path from 'path';

import { ExecUtil } from '../../module/boot/src/exec';
import { FsUtil } from '../../module/boot/src/fs';
import { FrameworkUtil } from '../../module/boot/src/framework';

const ROOT = FsUtil.resolveUnix(__dirname, '..', '..'); // Move up from ./bin folder;
const MOD_ROOT = `${ROOT}/module`;
const COMMON = ['test', 'doc', 'cli'].map(m => ({ type: 'dev' as const, file: `${MOD_ROOT}/${m}`, dep: `@travetto/${m}`, version: '' }));
const DEP_TYPES = ['dev', 'prod', 'opt'] as const;

const DOCUMENTED_PEER_DEPS = {
  'auth-rest': ['app'],
  'model-core': ['app'],
  openapi: ['app'],
  rest: ['app'],
  'rest-fastify': ['app'],
  'rest-koa': ['app'],
  'rest-express': ['app'],
  schema: ['app'],
};

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
  const base = path.basename(root);
  const pkg = `@travetto/${base}`;
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
  await FsUtil.symlink(`${ROOT}/node_modules/typescript`, `${root}/node_modules/typescript`);

  // Handle peer deps
  if (base in DOCUMENTED_PEER_DEPS) {
    for (const el of DOCUMENTED_PEER_DEPS[base as 'rest']) {
      const tgt = `${root}/node_modules/@travetto/${el}`;
      if (!(await FsUtil.exists(tgt))) {
        links += 1;
        await FsUtil.symlink(`${MOD_ROOT}/${el}`, tgt);
      }
    }
  }

  return `finalized ${`${links}`.padStart(3, ' ')} links`;
}

/**
 * Main Entry point
 */
export async function run() {
  const packages = (await ExecUtil.spawn(`npx`, ['lerna', 'ls', '-p', '-a']).result).stdout.split(/\n/)
    .filter(x => !!x && x.includes(FsUtil.cwd)).map(x => FsUtil.resolveUnix(x));

  // Finalize all modules
  console.log('Linking Modules');
  for (const pkg of packages) {
    await withMessage(`- @travetto/${path.basename(pkg)}`.padEnd(35), finalizeModule(pkg));
  }

  await withMessage('vscode-plugin install', async () => {
    const tgt = `${ROOT}/related/vscode-plugin`;
    await ExecUtil.spawn('npm', ['i'], { shell: true, cwd: tgt }).result.catch(err => { });
    await FsUtil.unlinkRecursive(`${tgt}/node_modules/@travetto/boot`, true);
    await FsUtil.mkdirp(`${tgt}/node_modules/@travetto/boot`);
    await FsUtil.copyRecursiveSync(`${MOD_ROOT}/boot/src`, `${tgt}/node_modules/@travetto/boot/src`);
    await fs.copyFile(`${MOD_ROOT}/boot/package.json`, `${tgt}/node_modules/@travetto/boot/package.json`);
    for (const el of ['config', 'doc', 'compiler', 'registry', 'base', 'test', 'app']) {
      await FsUtil.symlink(`${MOD_ROOT}/${el}`, `${tgt}/node_modules/@travetto/${el}`);
    }
    await FsUtil.symlink(`${MOD_ROOT}/cli/bin/travetto.js`, `${tgt}/node_modules/.bin/trv`);
  });
}
