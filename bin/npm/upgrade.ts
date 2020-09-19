import * as path from 'path';

import { ExecUtil } from '../../module/boot/src/exec';
import { FsUtil } from '../../module/boot/src/fs';
import { FrameworkUtil } from '../../module/boot/src/framework';

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
async function updateModule(root: string) {
  // Fetch deps
  const deps = await FrameworkUtil.resolveDependencies({ root, types: ['dev', 'prod', 'opt'], maxDepth: 0 });

  const resolved = deps
    .filter(x => /^[\^~]/.test(x.version))
    .map(({ dep, type, version }) =>
      ExecUtil.spawn(`npm`, ['show', `${dep}@${version}`, 'versions', '--json']).result
        .then(v => [dep, type, version.replace(/\d.*$/, JSON.parse(v.stdout).pop())] as [string, 'prod' | 'dev' | 'opt' | 'peer' | 'optPeer', string])
        .catch(err => [])
    );

  const toUpdate = (await Promise.all(resolved)).filter(x => !!x[2]);

  if (toUpdate.length) {
    const pkg = require(`${root}/package.json`);
    for (const [dep, type, version] of toUpdate) {
      switch (type) {
        case 'dev': pkg.devDependencies[dep] = version; break;
        case 'prod': pkg.dependencies[dep] = version; break;
        case 'peer': pkg.peerDependencies[dep] = version; break;
        case 'optPeer': pkg.optPeerDependencies[dep] = version; break;
        case 'opt': pkg.optionalDependencies[dep] = version; break;
      }
    }
  }

  return `updated ${toUpdate.length} dependencies`;
}

/**
 * Main Entry point
 */
export async function run() {
  const packages = (await ExecUtil.spawn(`npx`, ['lerna', 'ls', '-p', '-a']).result).stdout.split(/\n/)
    .filter(x => !!x && x.includes(FsUtil.cwd))
    .map(x => FsUtil.resolveUnix(x));

  // Finalize all modules
  console.log('Updating Modules');
  for (const pkg of packages) {
    await updateModule(pkg);
  }
}