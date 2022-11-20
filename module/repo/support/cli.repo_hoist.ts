import * as fs from 'fs/promises';

import { CliCommand } from '@travetto/cli';
import { path } from '@travetto/manifest';

import { Repo } from './bin/repo';
import { DEP_GROUPS } from './bin/types';

type Options = {};

/**
 * `npx trv repo:hoist`
 *
 * Hoists all dependencies
 */
export class RepoHoistCommand extends CliCommand<Options> {

  name = 'repo:hoist';

  async action(...args: unknown[]): Promise<void> {
    const root = await Repo.repoRoot;
    const rootPkg = await Repo.getRepoPackage();
    const modules = await Repo.modules;
    for (const mod of modules) {
      if (mod.pkg.private !== false) {
        rootPkg.devDependencies![mod.pkg.name] = `file:./${mod.folder}`;
      }

      for (const grp of DEP_GROUPS) {
        const depsToShare = Object.entries(mod.pkg[grp] ?? [])
          .map(([k, v]) => [k, v.startsWith('file:') ?
            `file:${path.resolve(root, mod.folder, v.split('file:')[1]).replace(root, '.').replace(/\\/g, '/')}` : v
          ]);

        const hoisted = depsToShare.filter(([k, v]) => (rootPkg.devDependencies ?? {})[k] !== v);
        if (hoisted.length > 0) {
          console.log(`Hoisting ${hoisted.length.toString().padStart(2, ' ')} deps for ${mod.folder}`);
        }
      }
    }

    rootPkg.devDependencies = Object.fromEntries(
      Object.entries(rootPkg.devDependencies!)
        .sort(([a], [b]) => a.localeCompare(b))
    );

    await fs.writeFile(path.resolve(root, 'package.json'), JSON.stringify(rootPkg, null, 2), 'utf8');
  }
}