import { ExecUtil, ExecutionOptions, ExecutionState, ExecutionResult } from '@travetto/base';
import { IndexedModule } from '@travetto/manifest';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease';

export class Npm {

  /**
   * Is a module already published
   */
  static isPublished(mod: IndexedModule, opts: ExecutionOptions): ExecutionState {
    return ExecUtil.spawn('npm', ['show', `${mod.name}@${mod.version}`, 'version', '--json'], opts);
  }

  /**
   * Validate published result
   */
  static validatePublishedResult(mod: IndexedModule, result: ExecutionResult): boolean {
    if (!result.valid && !result.stderr.includes('E404')) {
      throw new Error(result.stderr);
    }
    const item: (string[] | string) = result.stdout ? JSON.parse(result.stdout) : [];
    const found = Array.isArray(item) ? item.pop() : item;
    return !!found && found === mod.version;
  }

  /**
   * Setting the version
   */
  static async version(modules: IndexedModule[], level: SemverLevel, preid?: string): Promise<void> {
    const mods = modules.flatMap(m => ['-w', m.folder]);
    await ExecUtil.spawn('npm',
      ['version', level, ...(preid ? ['--preid', preid] : []), ...mods],
      { stdio: 'inherit' }
    ).result;
  }

  /**
   * Publish a module
   */
  static publish(mod: IndexedModule, dryRun: boolean | undefined, opts: ExecutionOptions): ExecutionState {
    const versionTag = mod.version.replace(/^.*-(rc|alpha|beta|next)[.]\d+/, (a, b) => b) || 'latest';
    return ExecUtil.spawn('npm',
      ['publish', ...(dryRun ? ['--dry-run'] : []), '--tag', versionTag, '--access', 'public'],
      opts
    );
  }
}