import fs from 'fs/promises';
import { Readable } from 'stream';

import { ManifestFileUtil, RootIndex, path } from '@travetto/manifest';
import { Env, FileResourceProvider, StreamUtil } from '@travetto/base';

import { ImageConverter } from './convert';

/**
 * Resource provider for images that allows for real-time optimization
 */
export class ImageOptimizingResourceProvider extends FileResourceProvider {

  #cacheRoot: string;

  constructor(paths?: string[], cacheRoot?: string) {
    super({ paths, includeCommon: true });

    this.#cacheRoot = cacheRoot ?? path.resolve(Env.get('TRV_IMAGE_CACHE', ManifestFileUtil.toolPath(RootIndex, 'image_cache')));
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
    await fs.mkdir(path.dirname(cachedOutput), { recursive: true });

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