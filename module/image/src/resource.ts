import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path/trv';

import { RuntimeContext } from '@travetto/manifest';
import { Env, ResourceLoader } from '@travetto/base';

import { ImageConverter } from './convert';

/**
 * Resource provider for images that allows for real-time optimization
 */
export class ImageOptimizingResourceLoader extends ResourceLoader {

  #cacheRoot: string;

  constructor(paths: string[] = [], cacheRoot?: string) {
    super(paths);

    this.#cacheRoot = cacheRoot ?? path.resolve(Env.TRV_IMAGE_CACHE.val || RuntimeContext.toolPath('image_cache'));
  }

  async #openFile(pth: string): Promise<fs.FileHandle> {
    return fs.open(path.join(this.#cacheRoot, pth.replace(/[\\/]/g, '__')));
  }

  /**
   * Fetch image, compress and return as buffer
   */
  async readOptimized(rel: string): Promise<Buffer> {
    const cachedOutput = path.resolve(this.#cacheRoot, rel);
    await fs.mkdir(path.dirname(cachedOutput), { recursive: true });

    const handle = await this.#openFile(cachedOutput);
    const exists = !!(await handle.stat().catch(() => false));

    if (!exists) {
      let stream: Buffer | Readable = await this.readStream(rel);
      if (/[.]png$/.test(rel)) {
        stream = await ImageConverter.optimize('png', stream);
      } else if (/[.]jpe?g$/i.test(rel)) {
        stream = await ImageConverter.optimize('jpeg', stream);
      }
      await pipeline(stream, handle.createWriteStream());
    }

    const buffer = await handle.readFile();
    await handle.close();
    return buffer;
  }
}