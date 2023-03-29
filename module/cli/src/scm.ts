import fs from 'fs/promises';

import { Env, ExecUtil } from '@travetto/base';
import { IndexedModule, RootIndex, path } from '@travetto/manifest';

export class CliScmUtil {
  /**
   * See if folder is a repository root
   * @param folder
   * @returns
   */
  static isRepoRoot(folder: string): Promise<boolean> {
    return fs.stat(path.resolve(folder, '.git')).then(() => true, () => false);
  }

  /**
   * Get author information
   * @returns
   */
  static async getAuthor(): Promise<{ name?: string, email: string }> {
    const [name, email] = await Promise.all([
      await ExecUtil.spawn('git', ['config', 'user.name'], { catchAsResult: true }).result,
      await ExecUtil.spawn('git', ['config', 'user.email']).result,
    ]);
    return {
      name: (name.valid ? name.stdout.trim() : '') || Env.get('USER'),
      email: email.stdout.trim()
    };
  }

  /**
   * Find the last code release
   * @returns
   */
  static async findLastRelease(): Promise<string | undefined> {
    const root = await RootIndex.manifest;
    const { result } = ExecUtil.spawn('git', ['log', '--pretty=oneline'], { cwd: root.workspacePath });
    return (await result).stdout
      .split(/\n/)
      .find(x => /Publish /.test(x))?.split(/\s+/)?.[0];
  }

  /**
   * Find all modules that changed since hash
   * @param hash
   * @returns
   */
  static async findChangedModulesSince(hash: string): Promise<IndexedModule[]> {
    const ws = RootIndex.manifest.workspacePath;
    const res = await ExecUtil.spawn('git', ['diff', '--name-only', `HEAD..${hash}`, ':!**/DOC.*', ':!**/README.*'], { cwd: ws }).result;
    const out = new Set<IndexedModule>();
    for (const line of res.stdout.split(/\n/g)) {
      const mod = RootIndex.getFromSource(path.resolve(ws, line));
      if (mod) {
        out.add(RootIndex.getModule(mod.module)!);
      }
    }
    return [...out].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a commit
   */
  static createCommit(message: string): Promise<string> {
    return ExecUtil.spawn('git', ['commit', '.', '-m', message]).result.then(r => r.stdout);
  }

  /**
   * Verify if workspace is dirty
   */
  static async isWorkspaceDirty(): Promise<boolean> {
    const res1 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code'], { catchAsResult: true }).result;
    const res2 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code', '--cached'], { catchAsResult: true }).result;
    return !res1.valid || !res2.valid;
  }
}