import * as fs from 'fs/promises';
import { Readable } from 'stream';
import { mkdirSync } from 'fs';

import { Env, FileResourceProvider, StreamUtil } from '@travetto/base';
import { path } from '@travetto/boot';

import { ImageConverter } from './convert';

/**
 * Resource provider for images that allows for real-time optimization
 */
export class ImageOptimizingResourceProvider extends FileResourceProvider {

  #cacheRoot: string;

  constructor(paths?: string[], cacheRoot?: string) {
    super(paths ?? Env.getList('TRV_RESOURCES'));

    this.#cacheRoot = cacheRoot ?? path.resolve(Env.get('TRV_IMAGE_CACHE', '.trv_images'));
    mkdirSync(this.#cacheRoot, { recursive: true });
  }

  async #openFile(pth: string): Promise<fs.FileHandle> {
    return fs.open(path.join(this.#cacheRoot, pth.replace(/[\\/]/g, '__')));
  }

  /**
   * Fetch image, compress and return as buffer
   */
  async readOptimized(rel: string): Promise<Buffer> {
    const { path: pth } = await this.describe(rel);
    const cachedOutput = path.resolve(this.#cacheRoot, rel);
    await fs.mkdir(path.dirname(cachedOutput));

    const handle = await this.#openFile(cachedOutput);
    const exists = !!(await handle.stat().catch(() => false));

    if (!exists) {
      let stream: Buffer | Readable = await this.readStream(rel);
      if (/[.]png$/.test(pth)) {
        stream = await ImageConverter.optimize('png', stream);
      } else if (/[.]jpe?g$/i.test(pth)) {
        stream = await ImageConverter.optimize('jpeg', stream);
      }
      await StreamUtil.pipe(stream, handle.createWriteStream());
    }

    const buffer = await handle.readFile();
    await handle.close();
    return buffer;
  }
}