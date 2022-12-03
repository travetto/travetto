import fs from 'fs/promises';

import { ExecUtil } from '@travetto/base';
import { IndexedModule, ModuleIndex } from '@travetto/boot';

import { SemverLevel } from './types';

export class Npm {

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

  static async getWorkspaceModules(): Promise<string[]> {
    const { result } = ExecUtil.spawn('npm', ['query', '.workspace']);
    const res: { location: string }[] = JSON.parse((await result).stdout);

    return res.map(d => d.location);
  }

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

  static async exec(cmd: string, args: string[]): Promise<void> {
    const run = ExecUtil.spawn('npm', [
      'exec',
      '--ws',
      cmd,
      ...args
    ], { stdio: [0, 1, 2] });
    await run.result;
  }
}