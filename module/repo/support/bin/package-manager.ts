import { ExecUtil, ExecutionOptions, ExecutionState, ExecutionResult } from '@travetto/base';
import { IndexedModule, ManifestContext } from '@travetto/manifest';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease';

/**
 * Utilities for working with package managers
 */
export class PackageManager {

  /**
   * Is a module already published
   */
  static isPublished(ctx: ManifestContext, mod: IndexedModule, opts: ExecutionOptions): ExecutionState {
    let args: string[];
    switch (ctx.packageManager) {
      case 'npm':
        args = ['show', `${mod.name}@${mod.version}`, 'version', '--json'];
        break;
      case 'yarn':
        args = ['info', `${mod.name}@${mod.version}`, 'dist.integrity', '--json'];
        break;
    }
    return ExecUtil.spawn(ctx.packageManager, args, opts);
  }

  /**
   * Validate published result
   */
  static validatePublishedResult(ctx: ManifestContext, mod: IndexedModule, result: ExecutionResult): boolean {
    switch (ctx.packageManager) {
      case 'npm': {
        if (!result.valid && !result.stderr.includes('E404')) {
          throw new Error(result.stderr);
        }
        const item: (string[] | string) = result.stdout ? JSON.parse(result.stdout) : [];
        const found = Array.isArray(item) ? item.pop() : item;
        return !!found && found === mod.version;
      }
      case 'yarn': {
        const res = JSON.parse(result.stdout);
        return res.data !== undefined;
      }
    }
  }

  /**
   * Setting the version
   */
  static async version(ctx: ManifestContext, modules: IndexedModule[], level: SemverLevel, preid?: string): Promise<void> {
    const mods = modules.flatMap(m => ['-w', m.sourceFolder]);
    let args: string[];
    switch (ctx.packageManager) {
      case 'npm':
      case 'yarn':
        args = ['version', level, ...(preid ? ['--preid', preid] : []), ...mods];
        break;
    }
    await ExecUtil.spawn(ctx.packageManager, args, { stdio: 'inherit' }).result;
  }

  /**
   * Dry-run packaging
   */
  static dryRunPackaging(ctx: ManifestContext, opts: ExecutionOptions): ExecutionState {
    let args: string[];
    switch (ctx.packageManager) {
      case 'npm':
      case 'yarn':
        args = ['pack', '--dry-run'];
        break;
    }
    return ExecUtil.spawn(ctx.packageManager, args, opts);
  }

  /**
   * Publish a module
   */
  static publish(ctx: ManifestContext, mod: IndexedModule, dryRun: boolean | undefined, opts: ExecutionOptions): ExecutionState {
    if (dryRun) {
      return this.dryRunPackaging(ctx, opts);
    }

    const versionTag = mod.version.replace(/^.*-(rc|alpha|beta|next)[.]\d+/, (a, b) => b) || 'latest';
    let args: string[];
    switch (ctx.packageManager) {
      case 'npm':
      case 'yarn':
        args = ['publish', '--tag', versionTag, '--access', 'public'];
        break;
    }
    return ExecUtil.spawn(ctx.packageManager, args, opts);
  }
}