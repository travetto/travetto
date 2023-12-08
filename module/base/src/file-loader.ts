import { createReadStream } from 'fs';
import { Readable } from 'stream';
import fs from 'fs/promises';

import { path, RuntimeIndex } from '@travetto/manifest';

import { AppError } from './error';

/**
 * File loader that will search for relative paths across the provided search paths
 */
export class FileLoader {

  #searchPaths: string[];

  constructor(paths: string[]) {
    this.#searchPaths = paths.flat().map(x => RuntimeIndex.resolveModulePath(x));
  }

  get searchPaths(): string[] {
    return this.#searchPaths.slice(0);
  }

  /**
   * Return the absolute path for the given relative path
   * @param relativePath The path to resolve
   */
  async resolve(relativePath: string): Promise<string> {
    for (const sub of this.#searchPaths) {
      const resolved = path.join(sub, relativePath);
      if (await fs.stat(resolved).catch(() => false)) {
        return resolved;
      }
    }
    throw new AppError(`Unable to find: ${relativePath}, searched=${this.#searchPaths.join(',')}`, 'notfound');
  }

  /**
   * Read a file, after resolving the path
   * @param relativePath The path to read
   */
  async read(relativePath: string, binary?: false): Promise<string>;
  async read(relativePath: string, binary: true): Promise<Buffer>;
  async read(relativePath: string, binary = false): Promise<string | Buffer> {
    const file = await this.resolve(relativePath);
    return fs.readFile(file, binary ? undefined : 'utf8');
  }

  /**
   * Read a file as a stream
   * @param relativePath The path to read
   */
  async readStream(relativePath: string, binary = true): Promise<Readable> {
    const file = await this.resolve(relativePath);
    return createReadStream(file, { encoding: binary ? undefined : 'utf8' });
  }
}