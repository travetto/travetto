import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, FsUtil, ScanEntry, ScanFs } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { color } from '@travetto/cli/src/color';

import { CompileCliUtil } from './index';
import { Config, File, PackManager } from './pack-manager';

const withMessage = async <T>(msg: string, op: Promise<T> | (() => Promise<T>)) => {
  process.stdout.write(`${msg} ... `);
  await ('call' in op ? op() : op)
    .then(() => process.stdout.write(color`${{ subtitle: 'done' }}`))
    .finally(() => process.stdout.write('\n'));
};

/**
 * Utils for packing source code and minimizing space usage
 */
export class PackUtil {

  /**
   * Build file include/exclude lists/checker
   * @param files
   */
  static buildFileIncExc(files: File[]) {
    const include = files.filter(x => !(typeof x === 'string' && x.startsWith('!')));
    const exclude = (files
      .filter(x => typeof x === 'string' && x.startsWith('!')) as string[])
      .map(x => x.substring(1))
      .map(x => {
        if (x.startsWith('*.')) {
          return new RegExp(`[.]${x.substring(2)}$`);
        } else if (x.startsWith('**/')) {
          return new RegExp(`^.*[\\\/][^\\\/]${x.substring(3)}`);
        } else {
          return new RegExp(`^${x}`);
        }
      });

    const check = (m: string) => !exclude.find(p => p?.test(m));
    return { include, exclude, check };
  }

  /**
   * Resolve all files
   */
  static async * iterateFileList(workspace: string, files: File[]): AsyncGenerator<[entry: ScanEntry, dest: string | string[]]> {
    const { include, check } = this.buildFileIncExc(files);

    for (const el of include) {
      const src = typeof el === 'string' ? el : Object.keys(el)[0];
      const dest = typeof el === 'string' ? el : Object.values(el)[0];
      const finalSrc = FsUtil.resolveUnix(workspace, src);
      const stat = await FsUtil.exists(finalSrc);
      if (!stat) { continue; }
      if (stat.isFile()) {
        if (check(src)) {
          yield [{ file: finalSrc, module: src, stats: stat }, dest];
        }
        continue;
      }
      for (const e of await ScanFs.scanDir({ testDir: check, testFile: check }, finalSrc)) {
        if (e.stats.isFile()) {
          if (check(e.module)) {
            yield [e, FsUtil.resolveUnix(workspace, dest as string, finalSrc.replace(src, '.'))];
          }
        }
      }
    }
  }

  /**
   * Find pack modes with associated metadata
   */
  static async getListOfPackModes() {
    const files = await ScanFs.scanDir({
      testDir: x => /node_modules\/?(@travetto\/?)?$/.test(x)
        || /node_modules\/@travetto\/[^/]+\/?/.test(x)
        || /node_modules\/@travetto\/[^/]+\/support\/?/.test(x),
      testFile: x => /pack[.].*[.]yml/.test(x) && /@travetto/.test(x)
    }, FsUtil.cwd);

    const lines = files
      .filter(x => x.stats.isFile())
      .filter(x => !x.module.includes('alt/docs')) // Docs
      .map(x => {
        const [, mod, name] = x.module.match(/.*@travetto\/([^/]+)\/.*pack[.]([^.]+).yml/) ?? [];
        const key = x.module.includes('compiler/bin') ? `<default>` : `${mod}/${name}`;
        return { key, file: x.module };
      });

    return lines;
  }

  /**
   * Minimize cached source files, by removing source mapping info
   * @param workspace
   * @param dir
   */
  static async cleanCache(cache: string) {
    // Drop source maps from cache
    for (const el of await fs.readdir(cache)) {
      if (el.endsWith('.js')) {
        const content = (await fs.readFile(`${cache}/${el}`, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(`${cache}/${el}`, content);
      }
    }
  }

  /**
   * Truncate all app source files, and framework sourc files
   * @param workspace
   */
  static async purgeSource(folders: string[]) {
    // Copy module files, empty at dest
    for (const sub of folders) {
      for (const f of await ScanFs.scanDir({ testFile: x => x.endsWith('.ts'), testDir: x => true }, sub)) {
        if (f.stats.isFile() && !f.module.startsWith('cli/')) {
          await fs.writeFile(f.file, '');
        }
      }
    }
  }

  /**
   * Zip a file into an outFile location (folder of file)
   * @param workspace
   * @param outFile
   */
  static async zipFile(workspace: string, outFile?: string) {
    const output = FsUtil.resolveUnix(outFile ?? 'dist');
    const zipFile = output.endsWith('.zip') ? output : FsUtil.resolveUnix(output, 'output.zip');
    await FsUtil.mkdirp(path.dirname(zipFile));
    try {
      await fs.unlink(zipFile);
    } catch { }
    ExecUtil.spawn('zip', ['-r', zipFile, '.'], { cwd: workspace });
  }

  /**
   * Pack the project into a workspace directory, optimized for space and runtime
   */
  static async pack(mgrOrMode: PackManager | string, config?: Partial<Config>) {
    const mgr = typeof mgrOrMode === 'string' ? await PackManager.get(mgrOrMode) : mgrOrMode;
    await mgr.addConfig(config);

    console.log('Executing with config', mgr.flags);

    await withMessage('Computing Node Modules', async () => {
      for (const el of await FrameworkUtil.resolveDependencies({ types: ['prod', 'opt'] })) {
        mgr.files.push({
          [el.file]: el.file
            .replace(FsUtil.cwd, '')
            .replace(path.dirname(FsUtil.cwd), '')
            .replace(path.dirname(path.dirname(FsUtil.cwd)), '')
            .replace(/^[\\/]/, './')
        });
      }
    });

    await withMessage('Cleaning Workspace', FsUtil.unlinkRecursive(mgr.workspace, true));

    await withMessage('Copying Content', async () => {
      for await (const [el, dest] of this.iterateFileList(mgr.workspace, mgr.files)) {
        await mgr.writeFile(el.file, dest);
      }
    });

    process.exit(0);

    // Compile
    await CompileCliUtil.compile(FsUtil.resolveUnix(mgr.workspace, mgr.cacheDir));

    if (!mgr.flags.keepSource) {
      await withMessage('Purging Source', async () => {
        await this.cleanCache(FsUtil.resolveUnix(mgr.workspace, mgr.cacheDir));
        await this.purgeSource([`${mgr.workspace}/node_modules/@travetto`, `${mgr.workspace}/src`]);
      });
    }

    await withMessage('Writng Env.js', async () => {
      if (mgr.flags.readonly || !mgr.flags.keepSource) {
        mgr.env.TRV_READONLY = '1';
      }
      await mgr.persistEnv();
    });

    // Build zip if desired
    if (mgr.flags.zip) {
      await this.zipFile(mgr.workspace, mgr.flags.output);
    }
  }
}