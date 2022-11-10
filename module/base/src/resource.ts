import { Readable } from 'stream';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';

import * as path from '@travetto/path';

import { AppError } from './error';
import { ModuleIndex } from '@travetto/boot';

export type ResourceDescription = { size: number, path: string };

/**
 * Primary contract for resource handling
 */
export interface ResourceProvider {
  /**
   * Describe the resource
   * @param pth The path to resolve
   */
  describe(pth: string): Promise<ResourceDescription>;

  /**
   * Read a resource, mimicking fs.read
   * @param pth The path to read
   */
  read(pth: string, binary?: false): Promise<string>;
  read(pth: string, binary: true): Promise<Buffer>;
  read(pth: string, binary?: boolean): Promise<string | Buffer>;

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   */
  readStream(pth: string, binary?: boolean): Promise<Readable>;
}

export class FileResourceProvider implements ResourceProvider {
  #paths: string[];


  constructor(paths: string[] = []) {
    this.#paths = paths.map(f =>
      ModuleIndex.hasModule(f) ?
        this.getModulePath(f, this.moduleFolder ?? this.pathFolder) :
        path.resolve(f, this.pathFolder ?? '')
    );
  }

  moduleFolder?: string;
  pathFolder?: string;
  maxDepth = 1000;

  async #getPath(file: string): Promise<string> {
    for (const sub of this.#paths) {
      if (await fs.stat(path.resolve(sub, file)).catch(() => false)) {
        return path.resolve(sub, file);
      }
    }
    throw new AppError(`Unable to find: ${file}, searched=${this.#paths.join(',')}`, 'notfound');
  }

  getAllPaths(): string[] {
    return this.#paths.slice(0);
  }

  getModulePath(mod: string, rel?: string): string {
    return path.resolve(ModuleIndex.getModule(mod)!.source, rel ?? '');
  }

  async describe(file: string): Promise<ResourceDescription> {
    file = await this.#getPath(file);
    const stat = await fs.stat(file);
    return { size: stat.size, path: file };
  }

  async read(file: string, binary?: false): Promise<string>
  async read(file: string, binary: true): Promise<Buffer>
  async read(file: string, binary = false) {
    file = await this.#getPath(file);
    return fs.readFile(file, binary ? undefined : 'utf8');
  }

  async readStream(file: string, binary = true): Promise<Readable> {
    file = await this.#getPath(file);
    return createReadStream(file, binary ? undefined : 'utf8');
  }

  async query(filter: (file: string) => boolean, maxDepth = this.maxDepth): Promise<string[]> {
    const search = [...this.#paths.map(x => [x, x, 0] as [string, string, number])];
    const seen = new Set();
    const out: string[] = [];
    while (search.length) {
      const [folder, root, depth] = search.shift()!;
      for (const sub of await fs.readdir(folder)) {
        if (sub.startsWith('.')) {
          continue;
        }
        const resolved = path.resolve(folder, sub);
        const stats = await fs.stat(resolved);
        if (stats.isDirectory()) {
          if (depth + 1 < maxDepth) {
            search.push([resolved, root, depth + 1])
          }
        } else {
          const rel = resolved.replace(`${root}/`, '');
          if (!seen.has(rel) && filter(rel)) {
            out.push(rel);
            seen.add(rel);
          }
        }
      }
    }
    return out;
  }
}