import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { RuntimeError } from './error.ts';
import { BinaryUtil, type BinaryArray, type BinaryStream } from './binary.ts';

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
    throw new RuntimeError(`Unable to find: ${relativePath}, searched=${this.searchPaths.join(',')}`, { category: 'notfound' });
  }

  /**
   * Read a file as utf8 text, after resolving the path
   * @param relativePath The path to read
   */
  async readText(relativePath: string): Promise<string> {
    const file = await this.resolve(relativePath);
    return fs.readFile(file, 'utf8');
  }

  /**
   * Read a file as a byte array, after resolving the path
   * @param relativePath The path to read
   */
  async readBinaryArray(relativePath: string): Promise<BinaryArray> {
    const file = await this.resolve(relativePath);
    return fs.readFile(file);
  }

  /**
   * Read a file as a stream
   * @param relativePath The path to read
   */
  async readBinaryStream(relativePath: string): Promise<BinaryStream> {
    const file = await this.resolve(relativePath);
    return createReadStream(file);
  }

  /**
   * Read a file as a File object
   * @param relativePath The path to read
   */
  async readFile(relativePath: string): Promise<File> {
    const buffer = BinaryUtil.binaryArrayToBuffer(await this.readBinaryArray(relativePath));
    return new File([buffer], path.basename(relativePath));
  }
}