import { promises as fs } from 'fs';
import * as os from 'os';

import { FsUtil } from '@travetto/boot';
import { YamlUtil } from '@travetto/yaml';

export class PackConfig {

  private _cacheDir = 'cache';
  workspace: string;
  cacheDir: string;
  add: Record<string, string>[] = [];
  exclude: string[] = [];
  excludeCompile: string[] = [];
  env: Record<string, string | undefined> = {
    TRV_CACHE: `\`\${__dirname}/${this._cacheDir}\``
  };
  flags = {
    workspace: FsUtil.resolveUnix(os.tmpdir(), 'travetto-pack'),
    readonly: true,
    keepSource: true,
    output: '' as string,
    zip: false
  };

  /**
   * Add a new config
   */
  async load(...input: (string | Partial<PackConfig> | undefined)[]) {
    for (const f of input) {
      if (!f || typeof f === 'string' && !(await FsUtil.exists(f))) {
        continue; // Skip missing
      }
      const c = typeof f === 'string' ? YamlUtil.parse(await fs.readFile(f, 'utf8')) as Partial<PackConfig> : f;
      this.exclude.unshift(...(c.exclude ?? []));
      this.excludeCompile.unshift(...(c.excludeCompile ?? []));
      this.add.unshift(...(c.add ?? []));
      Object.assign(this.flags, c.flags);
      Object.assign(this.env, c.env);
    }
    this.workspace = FsUtil.resolveUnix(FsUtil.cwd, this.flags.workspace); // Resolve against cwd
    this.cacheDir = FsUtil.resolveUnix(this.workspace, this._cacheDir);
    this.env.TRV_READONLY = (this.flags.readonly || !this.flags.keepSource) ? '1' : undefined;
    return this;
  }
}