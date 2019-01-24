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
      this.paths.push(FsUtil.resolveURI(Env.cwd, Env.appRoot));
    }

    this.paths.push(Env.cwd);

    this.paths = this.paths.map(x => FsUtil.resolveURI(x, this.folder)).filter(x => FsUtil.existsSync(x));
  }

  addPath(searchPath: string) {
    this.paths.push(FsUtil.toURI(searchPath));
  }

  getPaths() {
    return this.paths.slice(0);
  }

  async find(pth: string) {
    if (pth in this._cache) {
      return this._cache[pth];
    }

    for (const f of this.paths.map(x => FsUtil.resolveURI(x, pth))) {
      if (await FsUtil.exists(f)) {
        return this._cache[pth] = f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`);
  }

  async read(pth: string) {
    pth = await this.find(pth);
    return FsUtil.readFile(pth);
  }

  async readToStream(pth: string) {
    pth = await this.find(pth);
    return FsUtil.createReadStream(pth);
  }

  async findAllByExtension(ext: string, base: string = '') {
    const out: string[] = [];
    for (const root of this.paths) {
      const results = await ScanFs.scanDir({ testFile: x => x.endsWith(ext) }, FsUtil.resolveURI(root, base));
      out.push(...results.map(x => FsUtil.resolveURI(base, x.module)));
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager();