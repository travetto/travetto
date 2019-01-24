import * as path from 'path';
import * as fs from 'fs';

import { Env } from './env';
import { FsUtil } from './fs/fs-util';
import { AppError } from './error';
import { ScanFs } from './fs/scan-fs';

export class $ResourceManager {
  private _cache: { [key: string]: string } = {};

  private paths: string[] = [];

  constructor(private folder = 'resources') {
    this.init();
  }

  private init() {
    if (Env.appRoot) {
      this.paths.push(path.resolve(Env.cwd, Env.appRoot));
    }

    this.paths.push(Env.cwd);

    this.paths = this.paths.map(x => path.join(x, this.folder)).filter(x => fs.existsSync(x));
  }

  addPath(searchPath: string) {
    this.paths.push(FsUtil.normalize(searchPath));
  }

  getPaths() {
    return this.paths.slice(0);
  }

  async find(pth: string) {
    pth = FsUtil.normalize(pth);

    if (pth in this._cache) {
      return this._cache[pth];
    }

    for (const f of this.paths.map(x => path.join(x, pth))) {
      if (await FsUtil.existsAsync(f)) {
        return this._cache[pth] = f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`);
  }

  async read(pth: string) {
    pth = await this.find(pth);
    return FsUtil.readFileAsync(pth);
  }

  async readToStream(pth: string) {
    pth = await this.find(pth);
    return fs.createReadStream(pth);
  }

  async findAllByExtension(ext: string, base: string = '') {
    base = FsUtil.normalize(base);

    const out: string[] = [];
    for (const root of this.paths) {
      const results = await ScanFs.scanDir({ testFile: x => x.endsWith(ext) }, path.resolve(root, base));
      out.push(...results.map(x => `${base}/${x.module}`.replace(/[\/\\]+/g, '/')));
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager();