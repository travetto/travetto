import { BaseCliCommand, CliScmUtil, OptionConfig } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { RootIndex } from '@travetto/manifest';

import { PackageManager, SemverLevel } from './bin/package-manager';

type VersionOptions = {
  changed: OptionConfig<boolean>;
  force: OptionConfig<boolean>;
};

/**
* `npx trv repo:version`
*
* Version all all changed dependencies
*/
export class RepoVersionCommand extends BaseCliCommand<VersionOptions> {

  name = 'repo:version';

  getArgs(): string {
    return '<level> [prefix]';
  }

  getOptions(): VersionOptions {
    return {
      changed: this.boolOption({ desc: 'Only version changed modules', def: true }),
      force: this.boolOption({ desc: 'Force operation, even in a dirty workspace', def: false })
    };
  }

  async action(level: SemverLevel, prefix?: string): Promise<void> {
    if (!level) {
      return this.showHelp('Please specify a level to continue');
    }

    if (!this.cmd.force && await CliScmUtil.isWorkspaceDirty()) {
      return this.showHelp('Cannot update versions with uncommitted changes');
    }

    const allModules = await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all');

    const modules = allModules.filter(x => !x.internal);

    // Do we have valid changes?
    if (!modules.length) {
      console.error!('No modules available for versioning');
      return this.exit(1);
    }

    await PackageManager.version(RootIndex.manifest, modules, level, prefix);

    const versions = await CliModuleUtil.synchronizeModuleVersions();

    console.log!(await CliScmUtil.createCommit(`Publish ${modules.map(x => `${x.name}#${versions[x.name]?.replace('^', '') ?? x.version}`).join(',')}`));
  }
}