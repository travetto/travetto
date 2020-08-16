import * as fs from 'fs';

import { FsUtil, ScanFs, ScanEntry } from '@travetto/boot';

import { AppError } from './error';
import { AppManifest } from './manifest';

const cleanPath = (p: string) => p.charAt(0) === '/' ? p.substring(1) : p;

/**
 * Standard resource management interface allowing for look up by resource name
 * across multiple resource paths
 */
class $ResourceManager {
  private cache = new Map<string, string>();

  private paths: string[] = [];

  constructor(private rootPaths: string[], private folder = 'resources') {
    this.init();
  }

  private init() {
    this.paths.push(...this.rootPaths);

    this.paths = this.paths
      .map(x => FsUtil.resolveUnix(x, this.folder))
      .filter(x => FsUtil.existsSync(x));
  }

  /**
   * Consume Scan entry into indexing all resources available
   */
  private scanEntry(base: string, found: Set<string>, out: string[], r: ScanEntry) {
    if (r.stats.isDirectory()) {
      if (r.children) {
        for (const el of r.children!) {
          this.scanEntry(base, found, out, el);
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
    this.paths.push(FsUtil.resolveUnix(searchPath, full ? '' : this.folder));
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
    return this.paths.slice(0).map(x => x.replace(`${FsUtil.cwd}/`, ''));
  }

  /**
   * Provide an absolute path for a resource identifier
   * @param rel The relative path of a resource
   */
  async toAbsolutePath(rel: string) {
    rel = cleanPath(rel);
    await this.find(rel);
    return this.cache.get(rel)!;
  }

  /**
   * Provide an absolute path for a resource identifier, synchronously
   * @param rel The relative path of a resource
   */
  toAbsolutePathSync(rel: string) {
    rel = cleanPath(rel);
    this.findSync(rel);
    return this.cache.get(rel)!;
  }

  /**
   * Find a given resource and return it's location
   * @param pth The relative path of a resource to find
   */
  async find(pth: string) {
    pth = cleanPath(pth);
    if (this.cache.has(pth)) {
      return this.cache.get(pth)!;
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      if (await FsUtil.exists(f)) {
        this.cache.set(pth, f);
        return f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }


  /**
   * Find a given resource and return it's location, synchronously
   * @param pth The relative path of a resource to find
   */
  findSync(pth: string) {
    pth = cleanPath(pth);
    if (this.cache.has(pth)) {
      return this.cache.get(pth)!;
    }

    for (const f of this.paths.map(x => FsUtil.joinUnix(x, pth))) {
      if (FsUtil.existsSync(f)) {
        this.cache.set(pth, f);
        return f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.paths}`, 'notfound');
  }

  /**
   * Read a resource, mimicking fs.read
   * @param pth The path to read
   */
  async read(pth: string): Promise<Buffer>;
  async read(pth: string, options?: 'utf8' | 'utf-8' | { encoding: 'utf8' | 'utf-8' }): Promise<string>;
  /**
   * Read a resource, mimicking fs.read
   * @param pth The path to read
   * @param options The options to determine the read behavior
   */
  async read(pth: string, options?: string | { encoding?: string, flag?: string }) {
    pth = await this.find(pth);
    return fs.promises.readFile(pth, options);
  }

  /**
   * Read a resource, mimicking fs.read, and doing it synchronously
   * @param pth The path to read
   */
  readSync(pth: string): Buffer;
  readSync(pth: string, options: 'utf8' | 'utf-8' | { encoding: 'utf8' | 'utf-8' }): string;
  /**
   * Read a resource, mimicking fs.read, and doing it synchronously
   * @param pth The path to read
   * @param options The options to determine the read behavior
   */
  readSync(pth: string, options?: string | { encoding?: string, flag?: string }) {
    pth = this.findSync(pth);
    return fs.readFileSync(pth, options);
  }

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   * @param options The options to determine the read behavior
   */
  async readToStream(pth: string, options?: Parameters<typeof fs.createReadStream>[1]) {
    pth = await this.find(pth);
    return fs.createReadStream(pth, options);
  }

  /**
   * Find all resources by a specific pattern
   * @param pattern Pattern to search against
   * @param base The base folder to start searching from
   */
  async findAllByPattern(pattern: RegExp, base: string = '') {
    const out: string[] = [];
    const found = new Set<string>();

    for (const root of this.paths) {
      const results = await ScanFs.scanDir({ testFile: x => pattern.test(x) },
        FsUtil.resolveUnix(root, base));

      for (const r of results) {
        this.scanEntry(base, found, out, r);
      }
    }
    return out;
  }

  /**
   * Find all resources by a specific pattern, synchronously
   * @param pattern Pattern to search against
   * @param base The base folder to start searching from
   */
  findAllByPatternSync(pattern: RegExp, base: string = '') {
    const out: string[] = [];
    const found = new Set<string>();

    for (const root of this.paths) {
      const results = ScanFs.scanDirSync({ testFile: x => pattern.test(x) },
        FsUtil.resolveUnix(root, base));

      for (const r of results) {
        this.scanEntry(base, found, out, r);
      }
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager(AppManifest.resourceRoots);