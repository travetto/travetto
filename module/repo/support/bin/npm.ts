import { ExecUtil } from '@travetto/base';
import { IndexedModule } from '@travetto/manifest';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease';

export class Npm {

  /**
   * Is a module already published
   */
  static async isPublished(mod: IndexedModule): Promise<boolean> {
    const { result } = ExecUtil.spawn('npm', ['show', `${mod.name}@${mod.version}`, 'version', '--json'], { cwd: mod.source });

    const res = await result.catchAsResult();
    if (!res.valid && !res.stderr.includes('E404')) {
      throw new Error(res.stderr);
    }
    const item: (string[] | string) = res.stdout ? JSON.parse(res.stdout) : [];
    const found = Array.isArray(item) ? item.pop() : item;
    return !!found && found === mod.version;
  }

  /**
   * Setting the version
   */
  static async version(modules: IndexedModule[], level: SemverLevel, preid?: string): Promise<void> {
    const mods = modules.flatMap(m => ['-w', m.workspaceRelative]);
    await ExecUtil.spawn('npm',
      ['version', level, ...(preid ? ['--preid', preid] : []), ...mods],
      { stdio: 'inherit' }
    ).result;
  }

  /**
   * Publish a module
   */
  static async publish(mod: IndexedModule, dryRun?: boolean): Promise<void> {
    const versionTag = mod.version.replace(/^.*-(rc|alpha|beta|next)[.]\d+/, (a, b) => b) || 'latest';
    await ExecUtil.spawn('npm',
      ['publish', ...(dryRun ? ['--dry-run'] : []), '--tag', versionTag, '--access', 'public'],
      { cwd: mod.source, stdio: 'inherit' }
    ).result;
  }
}