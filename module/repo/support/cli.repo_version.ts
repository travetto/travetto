import { CliCommand, CliScmUtil, OptionConfig } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';

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

    await CliModuleUtil.synchronizeModuleVersions();

    console.log!(await CliScmUtil.createCommit(`Publish ${modules.map(x => x.name).join(',')}`));
  }
}