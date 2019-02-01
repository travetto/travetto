import * as fs from 'fs';
import * as util from 'util';

import { FsUtil } from './fs-util';
import { Env } from './env';
import { AppError } from './error';
import { ScanFs } from './scan-fs';

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);
const fsCreateReadStream = util.promisify(fs.createReadStream);

export class $ResourceManager {
  private _cache: { [key: string]: string } = {};

  private paths: string[] = [];

  constructor(private folder = 'resources') {
    this.init();
  }

  private init() {
    if (Env.get('RESOURCE_PATHS')) {
      this.paths.unshift(...Env.getList('RESOURCE_PATHS'));
    }

    if (Env.appRoot) {
      this.paths.push(Env.appRoot);
    }

    this.paths.push('.');

    this.paths = this.paths
      .map(x => FsUtil.resolveUnix(Env.cwd, x, this.folder))
      .filter(x => fs.existsSync(x));
  }

  addPath(searchPath: string, full = false) {
    this.paths.push(full ? FsUtil.resolveUnix(Env.cwd, searchPath) : FsUtil.resolveUnix(Env.cwd, searchPath, this.folder));
  }

  getPaths() {
    return this.paths.slice(0);
  }

  getRelativePaths() {
    return this.paths.slice(0).map(x => x.replace(`${Env.cwd}/`, ''));
  }

  async find(pth: string) {
    if (pth.startsWith('/')) {
      pth = pth.substring(1);
    }
    if (pth in this._cache) {
      return this._cache[pth];
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      try {
        await fsStat(f);
        return this._cache[pth] = f;
      } catch { }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`);
  }

  async read(pth: string, encoding?: string) {
    pth = await this.find(pth);
    return fsReadFile(pth, encoding);
  }

  async readToStream(pth: string) {
    pth = await this.find(pth);
    return fsCreateReadStream(pth, undefined);
  }

  async findAllByExtension(ext: string, base: string = '') {
    const out: string[] = [];
    for (const root of this.paths) {
      const results = await ScanFs.scanDir({ testFile: x => x.endsWith(ext) },
        FsUtil.resolveUnix(root, base));
      out.push(...results.map(x => `${base}/${x.module}`));
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager();