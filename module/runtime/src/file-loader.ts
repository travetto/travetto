import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';

import { AppError } from './error';
import { BlobUtil } from './blob';

/**
 * File loader that will search for files across the provided search paths
 */
export class FileLoader {

  #searchPaths: readonly string[];

  constructor(paths: string[]) {
    this.#searchPaths = [...new Set(paths)]; // Dedupe
  }

  /**
   * The paths that will be searched on resolve
   */
  get searchPaths(): readonly string[] {
    return this.#searchPaths;
  }

  /**
   * Return the absolute path for the given relative path
   * @param relativePath The path to resolve
   */
  async resolve(relativePath: string): Promise<string> {
    for (const sub of this.searchPaths) {
      const resolved = path.join(sub, relativePath);
      if (await fs.stat(resolved).catch(() => false)) {
        return resolved;
      }
    }
    throw new AppError(`Unable to find: ${relativePath}, searched=${this.searchPaths.join(',')}`, 'notfound');
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

  /**
   * Read a blob form a given path
   * @param relativePath The path to blob
   */
  async readBlob(relativePath: string): Promise<Blob> {
    const file = await this.resolve(relativePath);
    return BlobUtil.fileBlob(file);
  }
}