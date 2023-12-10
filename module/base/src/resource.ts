import { Readable } from 'node:stream';

import { Env } from './env';
import { FileLoader } from './file-loader';

class $ResourceLoader implements Omit<FileLoader, '#searchPaths'> {
  #paths: string[];
  #envTime = -1;
  #loader: FileLoader;

  constructor(paths: string[] = []) {
    this.#paths = paths;
    this.#checkEnv(true);
  }

  #checkEnv(force = false): void {
    if (force || this.#envTime !== Env.TRV_RESOURCES.touched) {
      this.#envTime = Env.TRV_RESOURCES.touched;
      this.#loader = new FileLoader(this.#paths, true);
    }
  }

  get searchPaths(): string[] {
    this.#checkEnv();
    return this.#loader.searchPaths;
  }

  async resolve(relativePath: string): Promise<string> {
    this.#checkEnv();
    return this.#loader.resolve(relativePath);
  }

  async read(relativePath: string, binary?: false): Promise<string>;
  async read(relativePath: string, binary: true): Promise<Buffer>;
  async read(relativePath: string, binary = false): Promise<string | Buffer> {
    this.#checkEnv();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#loader.read(relativePath, binary as false);
  }

  async readStream(relativePath: string, binary = true): Promise<Readable> {
    this.#checkEnv();
    return this.#loader.readStream(relativePath, binary);
  }
}

/**
 * File loader that will search for relative paths across the provided search paths
 */
export const ResourceLoader = new $ResourceLoader();