import fs from 'fs/promises';

import { ExecUtil } from '@travetto/base';
import { IndexedModule, ModuleIndex } from '@travetto/boot';

import { SemverLevel } from './types';

export class Npm {

  /**
   * Is a module already published
   */
  static async isPublished(mod: IndexedModule): Promise<boolean> {
    const proc = ExecUtil.spawn('npm', ['show', `${mod.name}@${mod.version}`, 'version', '--json'], { cwd: mod.source });

    return proc.result
      .catchAsResult!()
      .then(res => {
        if (!res.valid && !res.stderr.includes('E404')) {
          throw new Error(res.stderr);
        }
        const item = res.stdout ? JSON.parse(res.stdout) : [];
        const found = Array.isArray(item) ? item.pop() : item;
        return !!found;
      });
  }

  /**
   * Setting the version
   */
  static async version(modules: IndexedModule[], level: SemverLevel, preid?: string): Promise<void> {
    const run = ExecUtil.spawn('npm', [
      'version',
      level,
      ...(preid ? ['--preid', preid] : []),
      ...modules.flatMap(m => ['-w', m.workspaceRelative])
    ], {
      stdio: [0, 1, 2]
    });
    await run.result;
  }

  /**
   * Publish a module
   */
  static async publish(mod: IndexedModule, dryRun?: boolean): Promise<void> {
    const versionTag = mod.version.replace(/^.*-(rc|alpha|beta|next)[.]\d+/, (a, b) => b);

    const root = await ModuleIndex.manifest.workspacePath;

    await fs.copyFile(`${root}/LICENSE`, `${mod.source}/LICENSE`).catch(() => { });

    const { result } = ExecUtil.spawn('npm', [
      'publish',
      ...(dryRun ? ['--dry-run'] : []),
      '--tag', versionTag || 'latest',
      '--access', 'public'
    ], { cwd: mod.source, stdio: [0, 1, 2] });

    await result;
  }
}