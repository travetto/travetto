import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, FsUtil, ScanFs } from '@travetto/boot';
import { FrameworkUtil, DepType } from '@travetto/boot/src/framework';

import { PackUtil } from './util';

const MODULE_DIRS = ['src', 'bin', 'support', 'resources', 'index.ts', 'package.json', 'tsconfig.json'];

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
   * Truncate all app source files, and framework sourc files
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
      const stgt = FsUtil.resolveUnix(root, f);
      const ftgt = FsUtil.resolveUnix(target, f);
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
    for (const el of await FrameworkUtil.resolveDependencies({ types })) {
      const sub = el.file.replace(/.*?node_modules/, 'node_modules');
      const tgt = FsUtil.resolveUnix(workspace, sub);
      await FsUtil.mkdirp(path.dirname(tgt));

      if (el.dep.startsWith('@travetto')) {
        await this.copyModule(el.file, tgt);
      } else {
        if (!(await FsUtil.exists(tgt))) {
          await FsUtil.copyRecursiveSync(el.file, tgt);
        }
      }
    }
    await fs.copyFile(
      FsUtil.resolveUnix('node_modules/@travetto/boot/register.js'),
      FsUtil.resolveUnix(workspace, 'node_modules/@travetto/boot/register.js')
    );
  }

  /**
   * Compile workspace
   */
  static async compileWorkspace(root: string, cacheDir: string) {
    await ExecUtil.spawn(`node`, ['./node_modules/@travetto/cli/bin/travetto.js', 'compile'],
      { cwd: root, env: { TRV_CACHE: cacheDir } }).result;
  }

  /**
   * Copy over added content
   */
  static async copyAddedContent(workspace: string, files: Record<string, string>[]) {
    for (const a of files) {
      let [src, dest] = Object.entries(a)[0];
      [src, dest] = [FsUtil.resolveUnix(src), FsUtil.resolveUnix(workspace, dest)];
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