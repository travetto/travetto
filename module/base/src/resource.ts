import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

import { PathUtil, ScanFs, ScanEntry, FsUtil } from '@travetto/boot';

import { AppError } from './error';
import { AppManifest } from './manifest';

const cleanPath = (p: string): string => p.charAt(0) === '/' ? p.substring(1) : p;

/**
 * Standard resource management interface allowing for look up by resource name
 * across multiple resource paths
 */
class $ResourceManager {
  #cache = new Map<string, string>();

  #paths: string[] = [];
  #rootPaths: string[];

  constructor(rootPaths: string[]) {
    this.#rootPaths = rootPaths;
    this.#init();
  }

  #init(): void {
    this.#paths.push(...this.#rootPaths);

    this.#paths = this.#paths
      .map(x => PathUtil.resolveUnix(x))
      .filter(x => FsUtil.existsSync(x));
  }

  /**
   * Consume Scan entry into indexing all resources available
   */
  #scanEntry(base: string, found: Set<string>, out: string[], r: ScanEntry): void {
    if (ScanFs.isDir(r)) {
      if (r.children) {
        for (const el of r.children!) {
          this.#scanEntry(base, found, out, el);
        }
      }
      return;
    }
    const p = `${base}/${r.module}`;
    if (!found.has(p)) {
      found.add(p);
      out.push(p);
      this.#cache.set(p, r.file);
    }
  }

  /**
   * Add a new search path
   * @param searchPath Path to look through
   * @param full Is the path fully qualified or should it be relative to the cwd
   */
  addPath(searchPath: string, index = -1): void {
    if (index < 0) {
      this.#paths.push(PathUtil.resolveUnix(searchPath));
    } else {
      this.#paths.splice(index, 0, PathUtil.resolveUnix(searchPath));
    }
  }

  /**
   * List all paths
   */
  getPaths(): string[] {
    return this.#paths.slice(0);
  }

  /**
   * List all paths as relative to the cwd
   */
  getRelativePaths(): string[] {
    return this.#paths.slice(0).map(x => x.replace(`${PathUtil.cwd}/`, ''));
  }

  /**
   * Provide an absolute path for a resource identifier
   * @param rel The relative path of a resource
   */
  async findAbsolute(rel: string): Promise<string> {
    rel = cleanPath(rel);
    await this.find(rel);
    return this.#cache.get(rel)!;
  }

  /**
   * Find a given resource and return it's location
   * @param pth The relative path of a resource to find
   */
  async find(pth: string): Promise<string> {
    pth = cleanPath(pth);
    if (this.#cache.has(pth)) {
      return this.#cache.get(pth)!;
    }

    for (const f of this.#paths.map(x => PathUtil.joinUnix(x, pth))) {
      if (await FsUtil.exists(f)) {
        this.#cache.set(pth, f);
        return f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched: ${this.#paths}`, 'notfound');
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
  async read(pth: string, options?: Parameters<typeof fs.readFile>[1]): Promise<string | Buffer> {
    pth = await this.find(pth);
    return fs.readFile(pth, options);
  }

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   * @param options The options to determine the read behavior
   */
  async readStream(pth: string, options?: Parameters<typeof createReadStream>[1]): Promise<Readable> {
    pth = await this.find(pth);
    return createReadStream(pth, options);
  }

  /**
   * Find all resources by a specific pattern
   * @param pattern Pattern to search against
   * @param base The base folder to start searching from
   */
  async findAll(pattern: RegExp, base: string = ''): Promise<string[]> {
    const out: string[] = [];
    const found = new Set<string>();

    for (const root of this.#paths) {
      const results = await ScanFs.scanDir({ testFile: x => pattern.test(x) },
        PathUtil.resolveUnix(root, base));

      for (const r of results) {
        this.#scanEntry(base, found, out, r);
      }
    }
    return out;
  }
}

export const ResourceManager = new $ResourceManager(AppManifest.env.resources);