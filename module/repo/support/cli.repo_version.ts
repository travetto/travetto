import { CliCommand } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';

import { Git } from './bin/git';
import { Npm } from './bin/npm';
import { DEP_GROUPS, SemverLevel } from './bin/types';

/**
* `npx trv repo:version`
*
* Version all all changed dependencies
*/
export class RepoVersionCommand extends CliCommand {

  name = 'repo:version';

  getArgs(): string {
    return '[level] [prefix?]';
  }

  async action(level: SemverLevel, prefix?: string): Promise<void> {
    await Git.checkWorkspaceDirty('Cannot update versions with uncommitted changes');

    const modules = await CliModuleUtil.findModules('changed');
    await Npm.version(modules, level, prefix);

    // Force a reload
    Repo.reinit();

    const lookup = await Repo.lookup;
    const refreshed = modules.map(old => lookup.rel[old.source]);

    const graph = await Repo.graph;
    for (const mod of refreshed) {
      for (const dep of graph.get(mod) ?? []) {
        for (const field of DEP_GROUPS) {
          if (mod.name in (dep.pkg[field] ?? {})) {
            dep.pkg[field]![mod.name] = `^${mod.pkg.version}`;
          }
        }
      }
    }

    // Do we have valid changes?
    if (modules.length) {
      for (const mod of refreshed) {
        await Repo.writePackageJson(mod);
      }
      console.log!(await Git.publishCommit(modules.map(x => x.name).join(',')));
    }
  }
}