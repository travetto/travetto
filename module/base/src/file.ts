import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import { Readable } from 'stream';

import * as path from '@travetto/path';

import { Env } from './env';
import { ResourceDescription, ResourceProvider } from './resource';
import { AppError } from './error';

export class FileProvider {
  #paths: string[];

  constructor(paths: string[] = []) {
    this.#paths = paths;
  }

  async #getPath(file: string): Promise<string> {
    for (const sub of this.#paths) {
      if (await fs.stat(path.resolve(sub, file)).catch(() => false)) {
        return path.resolve(sub, file);
      }
    }
    throw new AppError(`Unable to find: ${file}, searched=${this.#paths.join(',')}`, 'notfound');
  }

  addPath(folder: string): void {
    this.#paths.push(folder);
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
}

@ResourceProvider('file')
export class FileResourceProvider extends FileProvider implements ResourceProvider {
  constructor(paths = [
    path.resolve('resources'),
    ...Env.getList('TRV_RESOURCES'),
  ]) {
    super(paths);
  }
}