import fs from 'fs/promises';

import { CliCommand, CliScmUtil } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { Package, PackageUtil } from '@travetto/manifest';

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
    if (await CliScmUtil.isWorkspaceDirty()) {
      console.error('Cannot update versions with uncommitted changes');
      process.exit(1);
    }

    const changed = (await CliModuleUtil.findModules('changed')).filter(x => !x.internal);
    await Npm.version(changed, level, prefix);

    const all = await CliModuleUtil.findModules('all');
    const packages = Object.fromEntries(
      all.map(x => [x.name, { pkg: PackageUtil.readPackage(x.source), mod: x }])
    );

    const refreshed = new Set<Package>();

    for (const mod of changed) {
      for (const dep of all) {
        const { pkg: depPkg } = packages[dep.name];
        for (const field of DEP_GROUPS) {
          if (depPkg[field] && mod.name in depPkg[field]! && /^[*]|(file:.*)$/.test(depPkg[field]![mod.name])) {
            depPkg[field]![mod.name] = `^${packages[mod.name].pkg.version}`;
            refreshed.add(depPkg);
          }
        }
      }
    }

    // Do we have valid changes?
    if (changed.length) {
      for (const mod of refreshed) {
        await fs.writeFile(`${packages[mod.name].mod.source}/package.json`, JSON.stringify(mod, null, 2), 'utf8');
      }
      console.log!(await CliScmUtil.createCommit(`Publish ${changed.map(x => x.name).join(',')}`));
    }
  }
}