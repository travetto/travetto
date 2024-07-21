import fs from 'node:fs/promises';

import { CliModuleUtil, CliCommandShape, CliCommand, CliScmUtil, CliValidationError } from '@travetto/cli';
import { Runtime } from '@travetto/base';

import { PackageManager, SemverLevel } from './bin/package-manager';

const CHANGE_LEVELS = new Set<SemverLevel>(['prerelease', 'patch', 'prepatch']);

/**
 * Version all changed dependencies
 */
@CliCommand()
export class RepoVersionCommand implements CliCommandShape {
  /** The mode for versioning */
  mode?: 'all' | 'changed' | 'direct';
  /** Force operation, even in a dirty workspace */
  force = false;
  /** Produce release commit message */
  commit = true;
  /**
   * The module when mode is single
   * @alias m
   */
  modules?: string[];
  /** Should we create a tag for the version */
  tag?: boolean;

  async validate(): Promise<CliValidationError | undefined> {
    if (!this.force && await CliScmUtil.isWorkspaceDirty()) {
      return { message: 'Cannot update versions with uncommitted changes' };
    }
  }

  async main(level: SemverLevel, prefix?: string): Promise<void> {
    const mode = this.mode ?? CHANGE_LEVELS.has(level) ? 'changed' : 'all';

    this.tag ??= (level === 'minor' || level === 'major');

    const allModules = await CliModuleUtil.findModules(mode === 'changed' ? 'changed' : 'all');

    const modules = allModules.filter(x => !x.internal && (this.mode !== 'direct' || this.modules?.includes(x.name)));

    // Do we have valid changes?
    if (!modules.length) {
      throw new Error('No modules available for versioning');
    }

    await PackageManager.version(Runtime, modules, level, prefix);

    const versions = await PackageManager.synchronizeVersions();
    if (this.commit) {
      const commitMessage = `Publish ${modules.map(x => `${x.name}#${versions[x.name]?.replace('^', '') ?? x.version}`).join(',')}`;
      console.log!(await CliScmUtil.createCommit(commitMessage));
      if (this.tag) {
        await CliScmUtil.createTag(versions['@travetto/manifest']);
      }

      // Touch package when done to trigger restart of compiler
      await fs.utimes(Runtime.context.workspaceRelative('package.json'), Date.now(), Date.now());
    }
  }
}