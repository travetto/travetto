import { createReadStream, existsSync } from 'fs';
import * as fs from 'fs/promises';
import { Readable } from 'stream';

import * as path from '@travetto/path';
import { AppError } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';

const cleanPath = (p: string): string => p.charAt(0) === '/' ? p.substring(1) : p;

class $TestFixtures {
  paths: string[] = [];

  constructor() {
    this.addPath('test/fixtures');
  }

  /**
   * Add a new search path
   * @param searchPath Path to look through
   */
  addPath(searchPath: string, index = -1): void {
    let resolved = path.resolve(searchPath);
    if (existsSync(resolved)) {
      if (index < 0) {
        this.paths.push(resolved);
      } else {
        this.paths.splice(index, 0, resolved);
      }
    }
  }

  /**
   * Add a new search path by module
   * @param modulePath Path in import form, to look through
   */
  addModulePath(modulePath: string, index = -1): void {
    // try {
    // console.error('HELLO', ModuleIndex.resolveImport(modulePath));
    return this.addPath(ModuleIndex.resolveImport(modulePath), index);
    // } catch { }
  }

  /**
   * Find a given resource and return it's location
   * @param pth The relative path of a resource to find
   */
  findSync(pth: string): string {
    pth = cleanPath(pth);

    for (const f of this.paths.map(x => path.join(x, pth))) {
      if (existsSync(f)) {
        return f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched=${this.paths.join(',')}`, 'notfound');
  }

  /**
   * Find a given resource and return it's location
   * @param pth The relative path of a resource to find
   */
  async find(pth: string): Promise<string> {
    pth = cleanPath(pth);

    for (const f of this.paths.map(x => path.join(x, pth))) {
      if (await fs.stat(f).catch(() => false)) {
        return f;
      }
    }

    throw new AppError(`Cannot find resource: ${pth}, searched=${this.paths.join(',')}`, 'notfound');
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
}

export const TestFixtures = new $TestFixtures();