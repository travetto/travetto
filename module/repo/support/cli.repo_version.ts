import { CliCommandShape, CliCommand, CliScmUtil, CliValidationError } from '@travetto/cli';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { RootIndex } from '@travetto/manifest';

import { PackageManager, SemverLevel } from './bin/package-manager';

/**
 * Version all changed dependencies
 */
@CliCommand()
export class RepoVersionCommand implements CliCommandShape {
  /** The mode for versioning */
  mode: 'all' | 'changed' | 'direct' = 'changed';
  /** Force operation, even in a dirty workspace */
  force = false;
  /** Produce release commit message */
  commit = true;
  /**
   * The module when mode is single
   * @alias m
   */
  modules?: string[];

  async validate(...args: unknown[]): Promise<CliValidationError | undefined> {
    if (!this.force && await CliScmUtil.isWorkspaceDirty()) {
      return { message: 'Cannot update versions with uncommitted changes' };
    }
  }

  async main(level: SemverLevel, prefix?: string): Promise<void> {
    const allModules = await CliModuleUtil.findModules(this.mode === 'changed' ? 'changed' : 'all');

    const modules = allModules.filter(x => !x.internal && (this.mode !== 'direct' || this.modules?.includes(x.name)));

    // Do we have valid changes?
    if (!modules.length) {
      throw new Error('No modules available for versioning');
    }

    await PackageManager.version(RootIndex.manifest, modules, level, prefix);

    const versions = await PackageManager.synchronizeVersions();
    if (this.commit) {
      const commitMessage = `Publish ${modules.map(x => `${x.name}#${versions[x.name]?.replace('^', '') ?? x.version}`).join(',')}`;
      console.log!(await CliScmUtil.createCommit(commitMessage));
    }
  }
}