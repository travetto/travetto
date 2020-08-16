import * as path from 'path';
import { promises as fs } from 'fs';

import { FsUtil } from '@travetto/boot';
import { YamlUtil } from '@travetto/yaml';


export type File = (string | Record<string, string | string[]>);

export type Flags = {
  keepSource?: boolean;
  readonly?: boolean;
  output?: string;
  workspace: string;
  zip?: boolean;
};

export interface Config {
  files: File[];
  env: Record<string, string>;
  flags: Flags;
}

export class PackManager {
  /**
   * Get a new manager for a given mode
   * @param mode
   */
  static async get(mode?: string) {
    const mgr = new PackManager();
    // Handle loading from string
    if (mode && mode.startsWith('@')) {
      const [, main, sub] = (mode.match(/@\S+\/\S+/) ?? []);
      mode = require.resolve(`@travetto/${main}/support/pack.${sub}.yml`);
    }

    await mgr.addConfig(FsUtil.resolveUnix(__dirname, '..', 'pack.config.yml'));
    await mgr.addConfig(mode);
    await mgr.addConfig(FsUtil.resolveUnix('pack.config.yml',));
    return mgr;
  }

  private _cacheDir = 'cache';
  private _workspace: string;
  private folders = new Set<string>();

  private readonly config: Config = {
    files: [],
    env: {
      TRV_CACHE: `\`\${__dirname}/${this._cacheDir}\``
    },
    flags: {
      workspace: 'dist/workspace',
      readonly: true,
      keepSource: true,
      zip: false
    }
  };

  get env() { return this.config.env; }
  get flags() { return this.config.flags; }
  get files() { return this.config.files; }
  get cacheDir() { return this._cacheDir; }

  get workspace() {
    if (!this._workspace && this.config.flags.workspace) {
      this._workspace = FsUtil.resolveUnix(FsUtil.cwd, this.config.flags.workspace); // Resolve against cwd
    }
    return this._workspace;
  }

  /**
   * Add a new config
   * @param f
   */
  async addConfig(f: string | Partial<Config> | undefined) {
    if (!f || typeof f === 'string' && !(await FsUtil.exists(f))) {
      return; // Skip missing
    }
    const c = typeof f === 'string' ? YamlUtil.parse(await fs.readFile(f, 'utf8')) as Config : f;
    this.config.files!.unshift(...(c.files ?? []));
    Object.assign(this.flags, c.flags);
    Object.assign(this.env, c.env);
    return true;
  }

  /**
   * Persist env
   */
  async persistEnv() {
    const out = `${this.workspace}/.env.js`;
    let src = '';
    if (!!(await FsUtil.exists(out))) {
      src = await fs.readFile(out, 'utf8');
    }
    for (const [key, value] of Object.entries(this.env)) {
      const finalVal = Array.isArray(value) ? `'${value.join(',')}'` : value;
      src = `${src}\nprocess.env['${key}'] = ${finalVal};`;
    }
    await fs.writeFile(out, src, { encoding: 'utf8' });
  }

  /**
   * Write file
   */
  async writeFile(file: string, dest: string | string[]) {
    const dests = Array.isArray(dest) ? dest : [dest];
    for (const d of dests) {
      const df = FsUtil.resolveUnix(this.workspace, d);
      const folder = path.basename(df) === path.basename(file) ? path.dirname(df) : df;
      const target = folder === df ? FsUtil.resolveUnix(folder, path.basename(file)) : df;
      if (!this.folders.has(folder)) {
        this.folders.add(folder);
        await FsUtil.mkdirp(folder);
      }
      await fs.copyFile(file, target);
    }
  }
}