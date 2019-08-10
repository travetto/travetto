import * as fs from 'fs';
import * as util from 'util';
import { Readable } from 'stream';

import { EnvUtil, FsUtil } from '@travetto/boot';
import { Env } from './env';
import { ScanFs, ScanEntry } from './scan-fs';

import { AppError } from './error';

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);

const cleanPath = (p: string) => p.charAt(0) === '/' ? p.substring(1) : p;

export class $ResourceManager {
  private cache: Record<string, string> = {};

  private paths: string[] = [];

  constructor(private rootPaths: string[], private folder = 'resources') {
    this.init();
  }

  private init() {
    this.paths.push(...this.rootPaths);

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

  async toAbsolutePath(rel: string) {
    rel = cleanPath(rel);
    await this.find(rel);
    return this.cache[rel];
  }

  toAbsolutePathSync(rel: string) {
    rel = cleanPath(rel);
    this.findSync(rel);
    return this.cache[rel];
  }

  async find(pth: string) {
    pth = cleanPath(pth);
    if (pth in this.cache) {
      return this.cache[pth];
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      try {
        await fsStat(f);
        return this.cache[pth] = f;
      } catch { }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }

  findSync(pth: string) {
    pth = cleanPath(pth);
    if (pth in this.cache) {
      return this.cache[pth];
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      try {
        fs.statSync(f);
        return this.cache[pth] = f;
      } catch { }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }

  async read(pth: string): Promise<Buffer>;
  async read(pth: string, options?: 'utf8' | { encoding: 'utf8' }): Promise<string>;
  async read(pth: string, options?: string | { encoding?: string; flag?: string; }) {
    pth = await this.find(pth);
    return fsReadFile(pth, options);
  }

  readSync(pth: string): Buffer;
  readSync(pth: string, options: 'utf8' | { encoding: 'utf8' }): string;
  readSync(pth: string, options?: string | { encoding?: string; flag?: string; }) {
    pth = this.findSync(pth);
    return fs.readFileSync(pth, options);
  }

  async readToStream(pth: string, options?: Parameters<typeof fs.createReadStream>[1]) {
    pth = await this.find(pth);
    const res = fs.createReadStream(pth, options);
    return res as Readable;
  }

  consumeEntryByExtension(base: string, found: Set<string>, out: string[], r: ScanEntry) {
    if (r.stats.isDirectory()) {
      if (r.children) {
        for (const el of r.children!) {
          this.consumeEntryByExtension(base, found, out, el);
        }
      }
      return;
    }
    const p = `${base}/${r.module}`;
    if (!found.has(p)) {
      found.add(p);
      out.push(p);
      this.cache[p] = r.file;
    }
  }

  async findAllByExtension(ext: string, base: string = '') {
    const out: string[] = [];
    const found = new Set<string>();
    const consume = this.consumeEntryByExtension.bind(this, base, found, out);

    for (const root of this.paths) {
      const results = await ScanFs.scanDir({ testFile: x => x.endsWith(ext) },
        FsUtil.resolveUnix(root, base));

      for (const r of results) {
        consume(r);
      }
    }
    return out;
  }

  findAllByExtensionSync(ext: string, base: string = '') {
    const out: string[] = [];
    const found = new Set<string>();
    const consume = this.consumeEntryByExtension.bind(this, base, found, out);

    for (const root of this.paths) {
      const results = ScanFs.scanDirSync({ testFile: x => x.endsWith(ext) },
        FsUtil.resolveUnix(root, base));

      for (const r of results) {
        consume(r);
      }
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager([
  ...Env.appRoots,
  ...EnvUtil.getList('RESOURCE_ROOTS')
]);