import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, PathUtil, ScanFs, FsUtil } from '@travetto/boot';

import { DependenciesUtil, DepType } from './depdencies';
import { PackUtil } from './util';

const MODULE_DIRS = ['src', 'bin', 'support', 'resources', 'index.ts', 'package.json', 'tsconfig.trv.json'];

/**
 * Utils for assmbling
 */
export class AssembleUtil {

  /**
   * Minimize cached source files, by removing source mapping info
   */
  static async cleanCache(cache: string) {
    for (const el of await fs.readdir(cache)) {
      if (el.endsWith('.js')) {
        const content = (await fs.readFile(`${cache}/${el}`, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(`${cache}/${el}`, content);
      }
    }
  }

  /**
   * Truncate all app source files, and framework source files
   */
  static async purgeSource(folders: string[]) {
    for (const sub of folders) {
      for (const f of await ScanFs.scanDir({ testFile: x => x.endsWith('.ts'), testDir: x => true }, sub)) {
        if (f.stats.isFile() && !f.module.startsWith('cli/')) {
          await fs.writeFile(f.file, '');
        }
      }
    }
  }

  /**
   * Copy a module
   */
  static async copyModule(root: string, target: string) {
    for (const f of MODULE_DIRS) {
      const stgt = PathUtil.resolveUnix(root, f);
      const ftgt = PathUtil.resolveUnix(target, f);
      const found = await FsUtil.exists(stgt);
      if (found) {
        if (found.isFile()) {
          await fs.copyFile(stgt, ftgt);
        } else {
          await FsUtil.mkdirp(ftgt);
          await FsUtil.copyRecursiveSync(`${stgt}/*`, ftgt);
        }
      }
    }
  }

  /**
   * Purge workspace using file rules
   */
  static async excludeFiles(root: string, files: string[]) {
    const checker = PackUtil.excludeChecker(files, root);
    for (const el of await ScanFs.scanDir({ testDir: x => true, testFile: checker, withHidden: true }, root)) {
      if (!el.stats.isFile()) { continue; }
      try {
        await fs.unlink(el.file);
      } catch { }
    }
  }

  /**
   * Copy over all prod dependnecies
   */
  static async copyDependencies(workspace: string, types: DepType[] = ['prod', 'opt', 'optPeer']) {

    for (const el of await DependenciesUtil.resolveDependencies({ types })) {
      const sub = PathUtil.normalizeFrameworkPath(el.file, 'node_modules/')
        .replace(/.*?node_modules/, 'node_modules');

      const tgt = PathUtil.resolveUnix(workspace, sub);
      await FsUtil.mkdirp(path.dirname(tgt));

      if (el.dep.startsWith('@travetto')) {
        await this.copyModule(el.file, tgt);
      } else {
        if (!(await FsUtil.exists(tgt))) {
          await FsUtil.copyRecursiveSync(el.file, tgt);
        }
      }
    }
    await FsUtil.copyRecursiveSync(
      PathUtil.resolveUnix(path.dirname(require.resolve('@travetto/boot/bin/main.js'))),
      PathUtil.resolveUnix(workspace, 'node_modules/@travetto/boot/bin')
    );
    await FsUtil.copyRecursiveSync(
      PathUtil.resolveUnix(path.dirname(require.resolve('@travetto/base/bin/main.js'))),
      PathUtil.resolveUnix(workspace, 'node_modules/@travetto/base/bin')
    );
  }

  /**
   * Compile workspace
   */
  static async buildWorkspace(root: string, cacheDir: string) {
    await ExecUtil.spawn('node', ['./node_modules/@travetto/cli/bin/trv.js', 'build'],
      { cwd: root, isolatedEnv: true, env: { TRV_ENV: 'prod', TRV_CACHE: cacheDir }, stdio: ['pipe', 'pipe', 2] }).result;
  }

  /**
   * Copy over added content
   */
  static async copyAddedContent(workspace: string, files: Record<string, string>[]) {
    for (const a of files) {
      let [src, dest] = Object.entries(a)[0];
      [src, dest] = [PathUtil.resolveUnix(src), PathUtil.resolveUnix(workspace, dest)];
      const stat = await FsUtil.exists(src);
      if (stat) {
        if (stat.isFile()) {
          await FsUtil.mkdirp(path.dirname(dest));
          await fs.copyFile(src, dest);
        } else {
          await FsUtil.mkdirp(path.dirname(dest));
          await FsUtil.copyRecursiveSync(src, dest);
        }
      }
    }
  }
}