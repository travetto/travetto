import * as path from 'path';
import { promises as fs } from 'fs';

import { ExecUtil, FsUtil, ScanFs } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { color } from '@travetto/cli/src/color';
import { Util } from '@travetto/base/src/util';
import { YamlUtil } from '@travetto/yaml';

import { CompileCliUtil } from './index';

type Flags = {
  keepSource?: boolean;
  readonly?: boolean;
  output?: string;
  zip?: boolean;
};

interface Config {
  delete?: {
    file?: Record<string, number>;
    folder?: Record<string, number>;
    ext?: Record<string, number>;
    module?: Record<string, number>;
  };
  copy?: {
    folder?: Record<string, string>;
    file?: Record<string, string | string[] | 0>;
  };
  env?: Record<string, string>;
  defaultFlags?: Flags;
}

const withMessage = async <T>(msg: string, op: () => Promise<T>) => {
  process.stdout.write(`${msg} ... `);
  try {
    await op();
    process.stdout.write(color`${{ subtitle: 'done' }}\n`);
  } catch (err) {
    process.stdout.write(`\n`);
    throw err;
  }
};

/**
 * Utils for packing source code and minimizing space usage
 */
export class PackUtil {

  /**
   * Find pack modes with associated metadata
   */
  static async getListOfPackModes() {
    const files = await ScanFs.scanDir({
      testDir: x => /node_modules\/?(@travetto\/?)?$/.test(x)
        || /node_modules\/@travetto\/[^/]+\/?/.test(x)
        || /node_modules\/@travetto\/[^/]+\/support\/?/.test(x),
      testFile: x => /pack[.].*[.]yml/.test(x)
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
   * Read configuration
   * @param provided
   */
  static async getModeConfig(...modes: string[]): Promise<Config | undefined> {
    for (const mode of modes.filter(x => !!x)) {
      const [main, sub] = mode.split(/\//) ?? [];
      let override = '';
      try {
        override = require.resolve(`@travetto/${main}/support/pack.${sub ?? 'config'}.yml`);
        return YamlUtil.parse(await fs.readFile(override, 'utf8')) as Config;
      } catch {
        try {
          return YamlUtil.parse(await fs.readFile(mode as string, 'utf8')) as Config;
        } catch { }
      }
    }
  }

  /**
   * Process config with given override
   * @param provided
   */
  static async getConfig(provided: Config = {}) {
    // Handle loading from string

    const config = YamlUtil.parse(await fs.readFile(FsUtil.resolveUnix(__dirname, '..', 'pack.config.yml'), 'utf8')) as Config;

    if (!!(await FsUtil.exists('pack.config.yml'))) {
      const override = YamlUtil.parse(await fs.readFile(FsUtil.resolveUnix('pack.config.yml',), 'utf8'));
      Util.deepAssign(config, override);
    }
    if (provided) {
      Util.deepAssign(config, provided);
    }

    return config as Config;
  }


  /**
   * Copy over files by instruction, folders first then individual
   * @param workspace
   * @param config
   */
  static async copyFiles(workspace: string, config: Config['copy'] = {}) {
    const files = { folder: {}, file: {}, ...config };
    // Copy over contents
    for (const [src, dest] of Object.entries(files.folder || {})) {
      const finalSrc = src.startsWith('@') ? `node_module/${src}` : src;
      const stat = await FsUtil.exists(finalSrc);
      if (stat) {
        FsUtil.copyRecursiveSync(finalSrc, `${workspace}/${dest}`);
      }
    }

    for (const [src, dest] of Object.entries(files.file ?? {})) {
      const finalSrc = src.startsWith('@') ? FsUtil.resolveUnix(`node_modules/${src}`) : src;
      const stat = await FsUtil.exists(finalSrc);

      if (stat) {
        const dests = Array.isArray(dest) ? dest : [dest];
        for (const d of dests) {
          await FsUtil.mkdirp(path.dirname(`${workspace}/${d ?? finalSrc}`));
          if (d) {
            await fs.copyFile(finalSrc, `${workspace}/${d}`);
          } else {
            await fs.writeFile(`${workspace}/${d}`, finalSrc.endsWith('.js') ? 'module.exports = {}' : '');
          }
        }
      }
    }
  }

  /**
   * Copy over all production node modules
   * @param workspace
   * @param deps
   */
  static async copyNodeModules(workspace: string, deps: string[]) {
    for (const el of deps) {
      if (el.includes('node_modules/')) {
        const suffix = el.replace(/^.*?node_modules\//, '');
        const suffixDir = path.dirname(el).replace(/^.*?node_modules\//, '');
        const existing = await FsUtil.exists(`${workspace}/node_modules/${suffix}`);
        if (existing) {
          continue;
        }

        if (suffixDir.endsWith('@travetto')) { // If dealing with travetto module
          await FsUtil.mkdirp(`${workspace}/node_modules/${suffix}`);
          const files = (require(`${el}/package.json`).files as string[] ?? []).filter(x => !x.startsWith('test'));
          for (const sub of ['package.json', ...files]) {
            const subEl = `${el}/${sub}`;
            const stat = (await FsUtil.exists(subEl))!;
            if (stat.isDirectory()) {
              await FsUtil.copyRecursiveSync(subEl, `${workspace}/node_modules/${suffix}/${sub}`);
            } else {
              await fs.copyFile(subEl, `${workspace}/node_modules/${suffix}/${sub}`);
            }
          }
        } else {
          await FsUtil.mkdirp(`${workspace}/node_modules/${suffixDir}`);
          await FsUtil.copyRecursiveSync(el, `${workspace}/node_modules/${suffix}`);
        }
      }
    }
  }

  /**
   * Minimize cached source files, by removing source mapping info
   * @param workspace
   * @param dir
   */
  static async cleanCache(workspace: string, dir = 'cache') {
    const cache = `${workspace}/${dir}`;
    // Drop source maps from cache
    for (const el of await fs.readdir(cache)) {
      if (el.endsWith('.js')) {
        const content = (await fs.readFile(`${cache}/${el}`, 'utf8')).replace(/\/\/# sourceMap.*/g, '');
        await fs.writeFile(`${cache}/${el}`, content);
      }
    }
  }

  /**
   * Delete all files by instruction
   */
  static async deleteFiles(workspace: string, conf: Config['delete'] = {}) {
    const del = { file: {}, ext: {}, folder: {}, module: {}, ...conf };

    // Delete all the files
    for (const f of await ScanFs.scanDir({ testFile: x => true, testDir: x => true }, `${workspace}/node_modules`)) {
      let ext = (f.stats.isFile() ? path.extname(f.file) : undefined)!;
      if (ext && f.file.endsWith('.d.ts')) {
        ext = '.d.ts';
      }
      const file = (f.stats.isFile() ? path.basename(f.file) : undefined)!;
      const folder = (f.stats.isDirectory() ? path.basename(f.file) : undefined)!;

      let doDelete = !!(del.file[file] || del.ext[ext] || del.folder[folder] || del.module[f.module]);

      if (!doDelete && folder === 'dist') {
        // Clear out dist folders
        const pkg = f.file.replace(/\/dist$/g, '/package.json');
        doDelete = !(!!(await FsUtil.exists(pkg)) && require(pkg).main.includes('dist'));
      }

      if (doDelete) {
        if (folder) {
          await FsUtil.unlinkRecursive(f.file, true);
        } else {
          try {
            await fs.unlink(f.file);
          } catch { }
        }
      }
    }
  }

  /**
   * Truncate all app source files, and framework sourc files
   * @param workspace
   */
  static async purgeSource(workspace: string) {
    // Copy module files, empty at dest
    for (const sub of [`${workspace}/node_modules/@travetto`, `${workspace}/src`]) {
      for (const f of await ScanFs.scanDir({ testFile: x => x.endsWith('.ts'), testDir: x => true }, sub)) {
        if (f.stats.isFile() && !f.module.startsWith('cli/')) {
          await fs.writeFile(f.file, '');
        }
      }
    }
  }

  /**
   * Create or Append to '.env.js' to set runtime behavior for packed workspace
   * @param workspace
   * @param env
   */
  static async extendEnvJs(workspace: string, env: Record<string, string | string[]>) {
    const out = `${workspace}/.env.js`;
    let src = '';
    if (!!(await FsUtil.exists(out))) {
      src = await fs.readFile(out, 'utf8');
    }
    for (const [key, value] of Object.entries(env)) {
      const finalVal = Array.isArray(value) ? `'${value.join(',')}'` : value;
      src = `${src}\nprocess.env['${key}'] = ${finalVal};`;
    }
    await fs.writeFile(out, src, { encoding: 'utf8' });
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
   * Minify js files
   */
  static async minifyJS(workspace: string) {
    for (const f of await ScanFs.scanDir({
      testFile: x => x.endsWith('.js')
    }, `${workspace}/node_modules`)) {
      if (!f.stats.isFile()) {
        continue;
      }

      await ExecUtil.spawn(`terser`, ['--compress', '-o', `${f.file}.out`, '--', f.file]).result;
      await fs.unlink(f.file);
      await fs.rename(`${f.file}.out`, f.file);
    }
  }

  /**
   * Pack the project into a workspace directory, optimized for space and runtime
   * @param workspace Directory to write to
   * @param flags Flags effect the packing method
   * @param config Config to pack with
   */
  static async pack(workspace: string, flags: Flags, config: Config) {

    workspace = FsUtil.resolveUnix(FsUtil.cwd, workspace); // Resolve against cwd

    const env = config.env ?? {};

    // eslint-disable-next-line no-template-curly-in-string
    env.TRV_CACHE = '`${__dirname}/cache`';

    if (flags.readonly || !flags.keepSource) {
      env.TRV_READONLY = '1';
    }

    await withMessage('Cleaning Workspace', async () => {
      await FsUtil.unlinkRecursive(workspace, true);
      await FsUtil.mkdirp(workspace);
    });

    await withMessage('Copying Content', () => this.copyFiles(workspace, config.copy));

    // Compile
    await CompileCliUtil.compile(`${workspace}/cache`);

    await withMessage('Copying Node Modules', async () => {
      const deps = (await FrameworkUtil.resolveDependencies({ types: ['prod', 'opt'] })).map(x => x.file);
      await this.copyNodeModules(workspace, deps);
    });

    if (!flags.keepSource) {
      await withMessage('Purging Source', async () => {
        await this.cleanCache(workspace);
        await this.purgeSource(workspace);
      });
    }

    await withMessage('Scrubbing Files', () => this.deleteFiles(workspace, config.delete));
    await withMessage('Writng Env.js', () => this.extendEnvJs(workspace, env));

    // Build zip if desired
    if (flags.zip) {
      await this.zipFile(workspace, flags.output);
    }
  }
}