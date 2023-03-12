import { BaseCliCommand, CliCommand, CliHelp, CliScmUtil } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { RootIndex } from '@travetto/manifest';

import { PackageManager, SemverLevel } from './bin/package-manager';

/**
 * Version all changed dependencies
 */
@CliCommand()
export class RepoVersionCommand implements BaseCliCommand {
  /** Only version changed modules */
  changed = true;
  /** Force operation, even in a dirty workspace */
  force = false;

  async action(level: SemverLevel, prefix?: string): Promise<void | CliHelp | number> {
    if (!this.force && await CliScmUtil.isWorkspaceDirty()) {
      return new CliHelp('Cannot update versions with uncommitted changes');
    }

    const allModules = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');

    const modules = allModules.filter(x => !x.internal);

    // Do we have valid changes?
    if (!modules.length) {
      console.error!('No modules available for versioning');
      return 1;
    }

    await PackageManager.version(RootIndex.manifest, modules, level, prefix);

    const versions = await CliModuleUtil.synchronizeModuleVersions();

    console.log!(await CliScmUtil.createCommit(`Publish ${modules.map(x => `${x.name}#${versions[x.name]?.replace('^', '') ?? x.version}`).join(',')}`));
  }
}