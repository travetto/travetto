import fs from 'node:fs/promises';

import { CliModuleUtil, type CliCommandShape, CliCommand, CliScmUtil, type CliValidationError } from '@travetto/cli';
import { ExecUtil, Runtime } from '@travetto/runtime';

import { PackageManager, type SemverLevel } from './bin/package-manager.ts';

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
    const mode = this.mode ?? CHANGE_LEVELS.has(level) ? 'changed' : 'workspace';

    this.tag ??= (level === 'minor' || level === 'major');

    const allModules = await CliModuleUtil.findModules(mode);

    const modules = allModules.filter(module => !module.internal && (this.mode !== 'direct' || this.modules?.includes(module.name)));

    // Do we have valid changes?
    if (!modules.length) {
      throw new Error('No modules available for versioning');
    }

    await ExecUtil.getResult(PackageManager.version(modules, level, prefix));

    const versions = await PackageManager.synchronizeVersions();
    if (this.commit) {
      const commitMessage = `Publish ${modules.map(module => `${module.name}#${versions[module.name]?.replace('^', '') ?? module.version}`).join(',')}`;
      console.log!(await CliScmUtil.createCommit(commitMessage));
      if (this.tag) {
        await CliScmUtil.createTag(versions['@travetto/manifest']);
      }

      // Touch package when done to trigger restart of compiler
      await fs.utimes(Runtime.workspaceRelative('package.json'), Date.now(), Date.now());
    }
  }
}