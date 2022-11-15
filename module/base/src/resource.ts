import { Readable } from 'stream';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';

import { ModuleIndex } from '@travetto/boot';
import { path } from '@travetto/common';

import { AppError } from './error';
import { Env } from './env';

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

/**
 * Simple file-based resource provider
 */
export class FileResourceProvider implements ResourceProvider {
  #paths: string[];
  #rawPaths: string[];

  moduleFolder?: string;
  mainFolder?: string;
  maxDepth = 1000;

  constructor(paths: string[]) {
    this.#rawPaths = paths;
  }


  #getModulePath(mod: string, rel?: string): string {
    return path.resolve(ModuleIndex.getModule(mod)!.source, rel ?? '');
  }

  #getPaths(): string[] {
    const main = ModuleIndex.manifest.main;
    return this.#paths ??= this.#rawPaths.map(pth => {
      const [base, sub] = pth.replace(/^@$/, main).replace(/^@#/, `${main}#`).split('#');

      return ModuleIndex.hasModule(base) ?
        this.#getModulePath(base, sub ?? (base !== main ? this.moduleFolder : undefined) ?? this.mainFolder) :
        path.resolve(base, sub ?? this.mainFolder ?? '');
    });
  }

  async #getPath(file: string): Promise<string> {
    for (const sub of this.#getPaths()) {
      const resolved = path.join(sub, file);
      if (await fs.stat(resolved).catch(() => false)) {
        return resolved;
      }
    }
    throw new AppError(`Unable to find: ${file}, searched=${this.#getPaths().join(',')}`, 'notfound');
  }

  getAllPaths(): string[] {
    return this.#paths.slice(0);
  }

  async describe(file: string): Promise<ResourceDescription> {
    file = await this.#getPath(file);
    const stat = await fs.stat(file);
    return { size: stat.size, path: file };
  }

  async read(file: string, binary?: false): Promise<string>;
  async read(file: string, binary: true): Promise<Buffer>;
  async read(file: string, binary = false): Promise<string | Buffer> {
    file = await this.#getPath(file);
    return fs.readFile(file, binary ? undefined : 'utf8');
  }

  async readStream(file: string, binary = true): Promise<Readable> {
    file = await this.#getPath(file);
    return createReadStream(file, binary ? undefined : 'utf8');
  }

  /**
   * Query using a simple predicate, looking for files recursively
   */
  async query(filter: (file: string) => boolean, hidden = false, maxDepth = this.maxDepth): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const search = [...this.#getPaths().map(x => [x, x, 0] as [string, string, number])];
    const seen = new Set();
    const out: string[] = [];
    while (search.length) {
      const [folder, root, depth] = search.shift()!;
      for (const sub of await fs.readdir(folder)) {
        if (sub === '.' || sub === '..' || (!hidden && sub.startsWith('.'))) {
          continue;
        }
        const resolved = path.resolve(folder, sub);
        const stats = await fs.stat(resolved);
        if (stats.isDirectory()) {
          if (depth + 1 < maxDepth) {
            search.push([resolved, root, depth + 1]);
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

/**
 * Simple file resource provider that relies on trv_resources
 */
export class CommonFileResourceProvider extends FileResourceProvider {
  constructor(paths: string[] = Env.getList('TRV_RESOURCES')) {
    super(paths);
  }
}