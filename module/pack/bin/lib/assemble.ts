import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, PathUtil, ScanFs, FsUtil } from '@travetto/boot';

import { DependenciesUtil, DepType } from './dependencies';
import { PackUtil } from './util';

const MODULE_DIRS = ['src', 'bin', 'support', 'resources', 'index.ts', 'package.json', 'tsconfig.trv.json'];

/**
 * Utils for assembling
 */
export class AssembleUtil {

  /**
   * Minimize cached source files, by removing source mapping info
   */
  static async cleanCache(cache: string): Promise<void> {
    for (const el of await fs.readdir(cache)) {
      if (el.endsWith('.ts') || el.endsWith('.js')) {
        const content = (await fs.readFile(`${cache}/${el}`, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(`${cache}/${el}`, content);
      }
    }
  }

  /**
   * Minimize cached source files, by removing source mapping info
   */
  static async cleanBoot(ws: string): Promise<void> {
    for (const el of await ScanFs.scanDir({
      testFile: f => f.endsWith('.js') || f.endsWith('.d.ts'),
      testDir: x => true
    }, `${ws}/node_modules/@travetto/boot`)) {
      if (el.file.endsWith('.d.ts')) {
        await fs.writeFile(el.file, '');
      } else if (el.file.endsWith('.js')) {
        const content = (await fs.readFile(el.file, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(el.file, content);
      }
    }
  }

  /**
   * Truncate all app source files, and framework source files
   */
  static async purgeSource(folders: string[]): Promise<void> {
    for (const sub of folders) {
      for (const f of await ScanFs.scanDir({ testFile: x => x.endsWith('.ts'), testDir: x => true }, sub)) {
        if (f.stats?.isFile() && !f.module.startsWith('cli/')) {
          await fs.writeFile(f.file, '');
        }
      }
    }
  }

  /**
   * Copy a module
   */
  static async copyModule(root: string, target: string): Promise<void> {
    for (const f of MODULE_DIRS) {
      const sourceFile = PathUtil.resolveUnix(root, f);
      const targetFile = PathUtil.resolveUnix(target, f);
      const found = await FsUtil.exists(sourceFile);
      if (found) {
        if (found.isFile()) {
          await fs.copyFile(sourceFile, targetFile);
        } else {
          await fs.mkdir(targetFile, { recursive: true });
          await FsUtil.copyRecursive(`${sourceFile}/*`, targetFile);
        }
      }
    }
  }

  /**
   * Purge workspace using file rules
   */
  static async excludeFiles(root: string, files: string[]): Promise<void> {
    const checker = PackUtil.excludeChecker(files, root);
    for (const el of await ScanFs.scanDir({ testDir: x => true, testFile: checker, withHidden: true }, root)) {
      if (!el.stats || !el.stats.isFile()) { continue; }
      try {
        await fs.unlink(el.file);
      } catch { }
    }
  }

  /**
   * Copy over all prod dependencies
   */
  static async copyDependencies(workspace: string, types: DepType[] = ['prod', 'opt', 'optPeer']): Promise<void> {

    for (const el of await DependenciesUtil.resolveDependencies({ types })) {
      const sub = PathUtil.normalizeFrameworkPath(el.file, 'node_modules/')
        .replace(/.*?node_modules/, 'node_modules');

      const tgt = PathUtil.resolveUnix(workspace, sub);
      await fs.mkdir(path.dirname(tgt), { recursive: true });

      if (el.dep.startsWith('@travetto')) {
        await this.copyModule(el.file, tgt);
      } else {
        if (!(await FsUtil.exists(tgt))) {
          await FsUtil.copyRecursive(el.file, tgt);
        }
      }
    }
    await FsUtil.copyRecursive(
      PathUtil.resolveUnix(path.dirname(require.resolve('@travetto/boot/bin/main.js'))),
      PathUtil.resolveUnix(workspace, 'node_modules/@travetto/boot/bin')
    );
    await FsUtil.copyRecursive(
      PathUtil.resolveUnix(path.dirname(require.resolve('@travetto/base/bin/main.js'))),
      PathUtil.resolveUnix(workspace, 'node_modules/@travetto/base/bin')
    );
  }

  /**
   * Compile workspace
   */
  static async buildWorkspace(root: string, cacheDir: string): Promise<void> {
    await ExecUtil.spawn('node', ['./node_modules/@travetto/cli/bin/trv.js', 'build'],
      {
        cwd: root, isolatedEnv: true,
        env: { TRV_ENV: 'prod', TRV_READONLY: '0', TRV_CACHE: cacheDir, TRV_NODE_VERSION: process.env.TRV_NODE_VERSION },
        stdio: ['pipe', 'pipe', 2]
      }).result;
  }

  /**
   * Copy over added content
   */
  static async copyAddedContent(workspace: string, files: Record<string, string>[]): Promise<void> {
    for (const a of files) {
      let [src, dest] = Object.entries(a)[0];
      [src, dest] = [PathUtil.resolveUnix(src), PathUtil.resolveUnix(workspace, dest)];
      const stat = await FsUtil.exists(src);
      if (stat) {
        if (stat.isFile()) {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        } else {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await FsUtil.copyRecursive(src, dest);
        }
      }
    }
  }
}