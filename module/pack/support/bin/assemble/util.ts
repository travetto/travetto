import fs from 'fs/promises';

import { path } from '@travetto/boot';
import { ExecUtil, FileResourceProvider } from '@travetto/base';

import { DependenciesUtil, DepType } from './dependencies';
import { PackUtil } from '../util';

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
    for (const el of await new FileResourceProvider([`${ws}/node_modules/@travetto/boot`]).query(
      f => f.endsWith('.js') || f.endsWith('.d.ts'),
    )) {
      if (el.endsWith('.d.ts')) {
        await fs.writeFile(el, '');
      } else if (el.endsWith('.js')) {
        const content = (await fs.readFile(el, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(el, content);
      }
    }
  }

  /**
   * Truncate all app source files, and framework source files
   */
  static async purgeSource(folders: string[]): Promise<void> {
    // TODO: Remove
    for (const sub of folders) {
    }
  }

  /**
   * Copy a module
   */
  static async copyModule(root: string, target: string): Promise<void> {
    for (const f of MODULE_DIRS) {
      const sourceFile = path.resolve(root, f);
      const targetFile = path.resolve(target, f);
      const found = await fs.stat(sourceFile).catch(() => { });
      if (found) {
        if (found.isFile()) {
          await fs.copyFile(sourceFile, targetFile);
        } else {
          await fs.mkdir(targetFile, { recursive: true });
          await PackUtil.copyRecursive(`${sourceFile}/*`, targetFile);
        }
      }
    }
  }

  /**
   * Purge workspace using file rules
   */
  static async excludeFiles(root: string, files: string[]): Promise<void> {
    const checker = PackUtil.excludeChecker(files, root);
    for (const el of await new FileResourceProvider([root]).query(checker, true)) {
      try {
        await fs.unlink(el);
      } catch { }
    }
  }

  /**
   * Copy over all prod dependencies
   */
  static async copyDependencies(workspace: string, types: DepType[] = ['prod', 'opt', 'peer']): Promise<void> {

    for (const el of await DependenciesUtil.resolveDependencies({ types })) {
      const sub = el.file.replace(/.*?node_modules/, 'node_modules');

      const tgt = path.resolve(workspace, sub);
      await fs.mkdir(path.dirname(tgt), { recursive: true });

      if (el.dep.startsWith('@travetto')) {
        await this.copyModule(el.file, tgt);
      } else {
        if (!(await fs.stat(tgt).catch(() => { }))) {
          await PackUtil.copyRecursive(el.file, tgt);
        }
      }
    }
  }

  /**
   * Compile workspace
   */
  static async buildWorkspace(root: string, cacheDir: string): Promise<void> {
    await ExecUtil.spawn('node', ['./node_modules/@travetto/cli/bin/trv.js', 'build'],
      {
        cwd: root, isolatedEnv: true,
        env: { TRV_ENV: 'prod', TRV_COMPILED: '0', TRV_CACHE: cacheDir, TRV_NODE_VERSION: process.env.TRV_NODE_VERSION },
        stdio: ['pipe', 'pipe', 2]
      }).result;
  }

  /**
   * Copy over added content
   */
  static async copyAddedContent(workspace: string, files: Record<string, string>[]): Promise<void> {
    for (const a of files) {
      let [src, dest] = Object.entries(a)[0];
      [src, dest] = [path.resolve(src), path.resolve(workspace, dest)];
      const stat = await fs.stat(src).catch(() => { });
      if (stat) {
        if (stat.isFile()) {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        } else {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await PackUtil.copyRecursive(src, dest);
        }
      }
    }
  }
}