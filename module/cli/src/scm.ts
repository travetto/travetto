import fs from 'node:fs/promises';

import { Spawn } from '@travetto/base';
import { IndexedFile, IndexedModule, RuntimeIndex, RuntimeContext, path } from '@travetto/manifest';

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
      await Spawn.exec('git', ['config', 'user.name']).result,
      await Spawn.exec('git', ['config', 'user.email']).success,
    ]);
    return {
      name: (name.valid ? name.stdout?.trim() : '') || process.env.USER,
      email: email.stdout!.trim()
    };
  }

  /**
   * Find the last code release
   * @returns
   */
  static async findLastRelease(): Promise<string | undefined> {
    const { stdout } = await Spawn.exec('git', ['log', '--pretty=oneline'], { cwd: RuntimeContext.workspace.path }).success;
    return stdout!
      .split(/\n/)
      .find(x => /Publish /.test(x))?.split(/\s+/)?.[0];
  }

  /**
   * Find all source files that changed between from and to hashes
   * @param fromHash
   * @returns
   */
  static async findChangedFiles(fromHash: string, toHash: string = 'HEAD'): Promise<string[]> {
    const ws = RuntimeContext.workspace.path;
    const res = await Spawn.exec('git', ['diff', '--name-only', `${fromHash}..${toHash}`, ':!**/DOC.*', ':!**/README.*'], { cwd: ws }).success;
    const out = new Set<string>();
    for (const line of res.stdout!.split(/\n/g)) {
      const entry = RuntimeIndex.getEntry(path.resolve(ws, line));
      if (entry) {
        out.add(entry.sourceFile);
      }
    }
    return [...out].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Find all modules that changed between from and to hashes
   * @param fromHash
   * @param toHash
   * @returns
   */
  static async findChangedModules(fromHash: string, toHash?: string): Promise<IndexedModule[]> {
    const files = await this.findChangedFiles(fromHash, toHash);
    const mods = files
      .map(x => RuntimeIndex.getFromSource(x))
      .filter((x): x is IndexedFile => !!x)
      .map(x => RuntimeIndex.getModule(x.module))
      .filter((x): x is IndexedModule => !!x);

    return [...new Set(mods)]
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a commit
   */
  static createCommit(message: string): Promise<string> {
    return Spawn.exec('git', ['commit', '.', '-m', message]).success.then(r => r.stdout!);
  }

  /**
   * Verify if workspace is dirty
   */
  static async isWorkspaceDirty(): Promise<boolean> {
    const res1 = await Spawn.exec('git', ['diff', '--quiet', '--exit-code']).result;
    const res2 = await Spawn.exec('git', ['diff', '--quiet', '--exit-code', '--cached']).result;
    return !res1.valid || !res2.valid;
  }
}