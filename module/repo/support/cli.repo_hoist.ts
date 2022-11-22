import { path } from '@travetto/manifest';
import { MutatingRepoCommand } from './command';

import { Repo } from './bin/repo';
import { DEP_GROUPS } from './bin/types';

/**
 * `npx trv repo:hoist`
 *
 * Hoists all dependencies
 */
export class RepoHoistCommand extends MutatingRepoCommand {

  name = 'repo:hoist';

  async action(...args: unknown[]): Promise<void> {
    const root = await Repo.root;
    const modules = await Repo.modules;
    for (const mod of modules) {
      if (mod.public) {
        root.pkg.devDependencies![mod.pkg.name] = `file:./${mod.rel}`;
      }

      let hoisted: string[] = [];
      for (const grp of DEP_GROUPS) {
        for (const [dep, version] of Object.entries(mod.pkg[grp] ?? {})) {
          let resolvedVersion = version;
          if (version.startsWith('file:')) {
            const [, verPath] = version.split('file:');
            const verPathFull = path.resolve(mod.full, verPath);
            const verPathRel = verPathFull.replace(root.full, '.');
            resolvedVersion = `file:${verPathRel}`;
          }
          if ((root.pkg.devDependencies ??= {})[dep] !== resolvedVersion) {
            hoisted.push(dep);
          }
        }
      }
      if (hoisted.length > 0) {
        console.log!(`${this.cmd.dryRun ? '[DRY-RUN] ' : ''}Hoisting ${hoisted.length.toString().padStart(2, ' ')} deps for ${mod.rel}`);
      }
    }

    root.pkg.devDependencies = Object.fromEntries(
      Object.entries(root.pkg.devDependencies!)
        .sort(([a], [b]) => a.localeCompare(b))
    );

    if (!this.cmd.dryRun) {
      await Repo.writePackageJson(root);
    }
  }
}