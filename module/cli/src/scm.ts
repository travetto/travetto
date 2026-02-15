import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { RuntimeError, ExecUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import type { IndexedModule } from '@travetto/manifest';

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
      ExecUtil.getResult(spawn('git', ['config', 'user.name']), { catch: true }),
      ExecUtil.getResult(spawn('git', ['config', 'user.email'])),
    ]);
    return {
      name: (name.valid ? name.stdout.trim() : '') || process.env.USER,
      email: email.stdout.trim()
    };
  }

  /**
   * Find the last code release
   * @returns
   */
  static async findLastRelease(): Promise<string | undefined> {
    const result = await ExecUtil.getResult(spawn('git', ['log', '--pretty=oneline'], { cwd: Runtime.workspace.path }));
    return result.stdout
      .split(/\n/)
      .find(line => /Publish /.test(line))?.split(/\s+/)?.[0];
  }

  /**
   * Find all source files that changed between from and to hashes
   * @param fromHash
   * @returns
   */
  static async findChangedFiles(fromHash: string, toHash: string = 'HEAD'): Promise<string[]> {
    const rootPath = Runtime.workspace.path;
    const result = await ExecUtil.getResult(spawn('git', ['diff', '--name-only', `${fromHash}..${toHash}`, ':!**/DOC.*', ':!**/README.*'], { cwd: rootPath }), { catch: true });
    if (!result.valid) {
      throw new RuntimeError('Unable to detect changes between', { category: 'data', details: { fromHash, toHash, output: (result.stderr || result.stdout) } });
    }
    const out = new Set<string>();
    for (const line of result.stdout.split(/\n/g)) {
      const entry = RuntimeIndex.getEntry(path.resolve(rootPath, line));
      if (entry) {
        out.add(entry.sourceFile);
      }
    }
    return [...out].toSorted((a, b) => a.localeCompare(b));
  }

  /**
   * Find all modules that changed between from and to hashes
   * @param fromHash
   * @param toHash
   * @returns
   */
  static async findChangedModules(fromHash: string, toHash?: string): Promise<IndexedModule[]> {
    const files = await this.findChangedFiles(fromHash, toHash);
    const modules = files
      .map(file => RuntimeIndex.getFromSource(file))
      .filter(file => !!file)
      .map(file => RuntimeIndex.getModule(file.module))
      .filter(module => !!module);

    return [...new Set(modules)]
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a commit
   */
  static createCommit(message: string): Promise<string> {
    return ExecUtil.getResult(spawn('git', ['commit', '.', '-m', message])).then(result => result.stdout);
  }

  /**
   * Create a tag
   */
  static createTag(version: string): Promise<string> {
    version = version.replace(/[^0-9a-z_\-.]/g, '');
    return ExecUtil.getResult(spawn('git', ['tag', '-a', `${version}`, '-m', `Release ${version}`])).then(result => result.stdout);
  }

  /**
   * Verify if workspace is dirty
   */
  static async isWorkspaceDirty(): Promise<boolean> {
    const res1 = await ExecUtil.getResult(spawn('git', ['diff', '--quiet', '--exit-code']), { catch: true });
    const res2 = await ExecUtil.getResult(spawn('git', ['diff', '--quiet', '--exit-code', '--cached']), { catch: true });
    return !res1.valid || !res2.valid;
  }
}