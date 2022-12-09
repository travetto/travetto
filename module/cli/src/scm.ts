import fs from 'fs/promises';

import { Env, ExecUtil } from '@travetto/base';
import { IndexedModule, RootIndex, path } from '@travetto/manifest';

export class CliScmUtil {
  /**
   * See if folder is a repository root
   * @param folder
   * @returns
   */
  static async isRepoRoot(folder: string): Promise<boolean> {
    if (await fs.stat(path.resolve(folder, '.git')).catch(() => { })) {
      return false;
    }
    return true;
  }

  /**
   * Get author information
   * @returns
   */
  static async getAuthor(): Promise<{ name?: string, email: string }> {
    const [name, email] = await Promise.all([
      await ExecUtil.spawn('git', ['config', 'user.name']).result.catchAsResult(),
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
  static async findLastRelease(): Promise<string> {
    const root = await RootIndex.manifest;
    const { result } = ExecUtil.spawn('git', ['log', '--pretty=oneline'], { cwd: root.workspacePath });
    return (await result)
      .stdout.split(/\n/)
      .find(x => /Publish /.test(x))!
      .split(/\s+/)[0]!;
  }

  /**
   * Find all modules that changed since hash
   * @param hash
   * @returns
   */
  static async findChangedModulesSince(hash: string): Promise<IndexedModule[]> {
    const root = await RootIndex.manifest;

    const result = await ExecUtil.spawn('git', ['diff', '--name-only', `HEAD..${hash}`], { cwd: root.workspacePath }).result;
    const out = new Set<IndexedModule>();
    for (const line of result.stdout.split(/\n/g)) {
      const mod = RootIndex.getFromSource(path.resolve(root.workspacePath, line));
      if (mod) {
        out.add(RootIndex.getModule(mod.module)!);
      }
    }
    return [...out].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a commit
   */
  static async createCommit(message: string): Promise<string> {
    const { result } = ExecUtil.spawn('git', ['commit', '.', '-m', message]);
    const res = await result;
    if (!res.valid) {
      throw new Error(res.stderr);
    }
    return res.stdout;
  }

  /**
   * Verify if workspace is dirty
   */
  static async isWorkspaceDirty(): Promise<boolean> {
    const res1 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code']).result.catchAsResult();
    const res2 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code', '--cached']).result.catchAsResult();
    return !res1.valid || !res2.valid;
  }
}