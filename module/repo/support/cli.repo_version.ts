import { CliCommand, CliScmUtil, OptionConfig } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { Package, PackageUtil } from '@travetto/manifest';

import { Npm, SemverLevel } from './bin/npm';

type VersionOptions = {
  changed: OptionConfig<boolean>;
};

/**
* `npx trv repo:version`
*
* Version all all changed dependencies
*/
export class RepoVersionCommand extends CliCommand<VersionOptions> {

  name = 'repo:version';

  getArgs(): string {
    return '[level] [prefix?]';
  }

  getOptions(): VersionOptions {
    return {
      changed: this.boolOption({ desc: 'Only version changed modules', def: true })
    };
  }

  async action(level: SemverLevel, prefix?: string): Promise<void> {
    if (await CliScmUtil.isWorkspaceDirty()) {
      console.error!('Cannot update versions with uncommitted changes');
      process.exit(1);
    }

    const modules = (await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all')).filter(x => !x.internal);

    // Do we have valid changes?
    if (modules.length) {
      console.error!('No modules available for versioning');
      process.exit(1);
    }

    await Npm.version(modules, level, prefix);

    const all = await CliModuleUtil.findModules('all');
    const packages = Object.fromEntries(all.map(mod => {
      const pkg = PackageUtil.readPackage(mod.source);
      const write = (): Promise<void> => PackageUtil.writePackage(mod.source, pkg);
      return [mod.name, { pkg, mod, write }];
    }));

    const refreshed = new Set<Package>();

    for (const mod of modules) {
      for (const dep of all) {
        const { pkg } = packages[dep.name];
        for (const group of [
          pkg.dependencies ?? {},
          pkg.devDependencies ?? {},
          pkg.optionalDependencies ?? {},
          pkg.peerDependencies ?? {}
        ]) {
          if (mod.name in group && !/^[*]|(file:.*)$/.test(group[mod.name])) {
            group[mod.name] = `^${packages[mod.name].pkg.version}`;
            refreshed.add(pkg);
          }
        }
      }
    }

    for (const mod of refreshed) {
      await packages[mod.name].write();
    }

    console.log!(await CliScmUtil.createCommit(`Publish ${modules.map(x => x.name).join(',')}`));
  }
}