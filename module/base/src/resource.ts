import * as fs from 'fs';
import * as util from 'util';

import { FsUtil, EnvUtil } from '@travetto/boot';

import { Env } from './env';
import { ScanFs, ScanEntry } from './scan-fs';

import { AppError } from './error';

const fsStat = util.promisify(fs.stat);
const fsReadFile = util.promisify(fs.readFile);

const cleanPath = (p: string) => p.charAt(0) === '/' ? p.substring(1) : p;

/**
 * Standard resource management interface allowing for look up by resource name
 * across multiple resource paths
 */
export class $ResourceManager {
  private cache = new Map<string, string>();

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

  /**
   * Consume Scan entry into indexing all resources available
   */
  private consumeEntryByExtension(base: string, found: Set<string>, out: string[], r: ScanEntry) {
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
      this.cache.set(p, r.file);
    }
  }

  /**
   * Add a new search path
   * @param searchPath Path to look through
   * @param full Is the path fully qualified or should it be relative to the cwd
   */
  addPath(searchPath: string, full = false) {
    this.paths.push(full ? FsUtil.resolveUnix(Env.cwd, searchPath) : FsUtil.resolveUnix(Env.cwd, searchPath, this.folder));
  }

  /**
   * List all paths
   */
  getPaths() {
    return this.paths.slice(0);
  }

  /**
   * List all paths as relative to the cwd
   */
  getRelativePaths() {
    return this.paths.slice(0).map(x => x.replace(`${Env.cwd}/`, ''));
  }

  /**
   * Provide an absolute path for a resource identifier
   */
  async toAbsolutePath(rel: string) {
    rel = cleanPath(rel);
    await this.find(rel);
    return this.cache.get(rel)!;
  }

  /**
   * Provide an absolute path for a resource identifier, synchronously
   */
  toAbsolutePathSync(rel: string) {
    rel = cleanPath(rel);
    this.findSync(rel);
    return this.cache.get(rel)!;
  }

  /**
   * Find a given resource and return it's location
   */
  async find(pth: string) {
    pth = cleanPath(pth);
    if (pth in this.cache) {
      return this.cache.get(pth)!;
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      try {
        await fsStat(f);
        this.cache.set(pth, f);
        return f;
      } catch { }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }


  /**
   * Find a given resource and return it's location, synchronously
   */
  findSync(pth: string) {
    pth = cleanPath(pth);
    if (pth in this.cache) {
      return this.cache.get(pth)!;
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      try {
        fs.statSync(f);
        this.cache.set(pth, f);
        return f;
      } catch { }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }

  /**
   * Read a resource, mimicking fs.read
   */
  async read(pth: string): Promise<Buffer>;
  async read(pth: string, options?: 'utf8' | { encoding: 'utf8' }): Promise<string>;
  async read(pth: string, options?: string | { encoding?: string, flag?: string }) {
    pth = await this.find(pth);
    return fsReadFile(pth, options);
  }

  /**
   * Read a resource, mimicking fs.read, and doing it synchronously
   */
  readSync(pth: string): Buffer;
  readSync(pth: string, options: 'utf8' | { encoding: 'utf8' }): string;
  readSync(pth: string, options?: string | { encoding?: string, flag?: string }) {
    pth = this.findSync(pth);
    return fs.readFileSync(pth, options);
  }

  /**
   * Read a resource as a stream, mimicking fs.readStream
   */
  async readToStream(pth: string, options?: Parameters<typeof fs.createReadStream>[1]) {
    pth = await this.find(pth);
    return fs.createReadStream(pth, options);
  }

  /**
   * Find all resources by a specific extension
   */
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

  /**
   * Find all resources by a specific extension, synchronously
   */
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