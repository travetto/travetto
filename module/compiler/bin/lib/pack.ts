import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, FsUtil, ScanFs } from '@travetto/boot';
import { FrameworkUtil, } from '@travetto/boot/src/framework';
import { color } from '@travetto/cli/src/color';

import { PackConfig } from './pack-config';

type DepTypes = Parameters<(typeof FrameworkUtil)['resolveDependencies']>[0]['types'];

const MODULE_DIRS = ['src', 'bin', 'support', 'resources', 'index.ts', 'package.json', 'tsconfig.json'];

const withMessage = async <T>(msg: string, op: Promise<T> | (() => Promise<T>)) => {
  process.stdout.write(color`  ${{ path: msg }} `.padEnd(60));
  process.stdout.write('... ');
  await ('call' in op ? op() : op)
    .then((v) => process.stdout.write(color`${{ output: v ?? 'done' }}`))
    .finally(() => process.stdout.write('\n'));
};

/**
 * Utils for packing source code and minimizing space usage
 */
export class PackUtil {

  /**
   * Build file include/exclude lists/checker
   */
  static deleteChecker(files: string[]) {
    const all = files.map(x => {
      const negate = x.startsWith('!');
      x = negate ? x.substring(1) : x;
      if (!x.startsWith('/')) {
        x = `**/${x}`;
      }
      // TODO: Replace with something better?
      const re = x // Poor man's glob
        .replace(/^[*][*][/]/, '**')
        .replace(/[*][*.]?/g, r => {
          switch (r) {
            case '**': return /([^\\\/]+[\\\/])*([^\\\/]*)/.source;
            case '*.': return /.*[.]/.source;
            case '*': return /[^.\\\/]*/.source;
            default: throw new Error('Unknown');
          }
        });
      return [new RegExp(`^${re}`), negate] as [RegExp, boolean];
    });

    return (f: string) => {
      let remove = false;
      for (const [p, n] of all) {
        if (p.test(f)) {
          remove = !n;
        }
      }
      return remove;
    };
  }

  /**
   * Find pack modes with associated metadata
   */
  static async getListOfPackModes() {
    return FrameworkUtil.scan(f => /\/support\/pack[.].*[.]ya?ml/.test(f))
      .filter(x => x.stats.isFile())
      .map(x => {
        const [, mod, name] = x.module.match(/.*@travetto\/([^/]+)\/.*pack[.]([^.]+).ya?ml/) ?? [];
        const key = x.module.includes('compiler/bin') ? `<default>` : `${mod}/${name}`;
        return { key, file: x.module };
      });
  }

  /**
   * Get a new manager for a given mode
   */
  static getManager(...configs: (string | undefined | Partial<PackConfig>)[]) {
    return new PackConfig().load(
      FsUtil.resolveUnix(__dirname, '..', 'pack.config.yml'),
      ...configs,
      FsUtil.resolveUnix('pack.config.yml'),
      FsUtil.resolveUnix('pack.config.yaml'));
  }

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
   * Zip a file into an outFile location (folder of file)
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
    const checker = this.deleteChecker(files);
    for (const el of await ScanFs.scanDir({ testDir: x => true, testFile: checker, withHidden: true }, root)) {
      if (!el.stats.isFile()) { continue; }
      try {
        await fs.unlink(el.file);
      } catch { }
    }
  }

  /**
   * Delete all empty folders
   */
  static async removeEmptyFolders(root: string) {
    for (const el of await ScanFs.scanDir({ testDir: x => true, testFile: x => false, withHidden: true }, root)) {
      let dir = el.file;
      while ((await fs.readdir(dir)).length === 0) { // empty
        await fs.rmdir(dir);
        dir = path.dirname(dir);
      }
    }
  }

  /**
   * Copy over all prod dependnecies
   */
  static async copyDependencies(workspace: string, types: DepTypes = ['prod', 'opt', 'optPeer']) {
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
      if (await FsUtil.exists(src)) {
        await FsUtil.mkdirp(path.dirname(dest));
        await fs.copyFile(src, dest);
      }
    }
  }

  /**
   * Update .env.js with new env data
   */
  static async writeEnvJs(workspace: string, env: Record<string, string | undefined>) {
    const out = `${workspace}/.env.js`;
    let src = '';
    if (!!(await FsUtil.exists(out))) {
      src = await fs.readFile(out, 'utf8');
    }
    const lines = Object.entries(env).filter(([, v]) => !!v).map(([k, v]) => `process.env['${k}'] = ${v};`);
    const content = `${src}\n${lines.join('\n')}`;
    await fs.writeFile(FsUtil.resolveUnix(workspace, '.env.js'), content, { encoding: 'utf8' });
  }

  /**
   * Pack the project into a workspace directory, optimized for space and runtime
   */
  static async pack({ workspace, cacheDir, add, exclude, excludeCompile, env, flags }: PackConfig) {
    console.log(color`${{ title: 'Executing with Flags' }}`, flags);

    await withMessage('Cleaning Workspace', FsUtil.unlinkRecursive(workspace, true).then(() => { }));
    await withMessage('Copying Dependencies', this.copyDependencies(workspace));
    await withMessage('Copying App Content', this.copyModule(FsUtil.cwd, workspace));
    await withMessage('Excluding Pre-Compile Files', this.excludeFiles(workspace, excludeCompile));
    await withMessage(`Compiling at ${workspace}`, this.compileWorkspace(workspace, cacheDir));
    await withMessage('Excluding Post-Compile Files', this.excludeFiles(workspace, exclude));
    await withMessage('Copying Added Content', this.copyAddedContent(workspace, add));
    await withMessage('Removing Empty Folders', this.removeEmptyFolders(workspace));
    await withMessage('Writng Env.js', this.writeEnvJs(workspace, env));

    if (!flags.keepSource) {
      await withMessage('Remove Source Maps', this.cleanCache(cacheDir));
      await withMessage('Emptying .ts Files', this.purgeSource([`${workspace}/node_modules/@travetto`, `${workspace}/src`]));
    }

    if (flags.zip) {
      await withMessage(`Zipping to ${flags.output}`, this.zipFile(workspace, flags.output));
    }
  }
}