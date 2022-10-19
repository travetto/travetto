import * as fs from 'fs/promises';
import { mkdirSync } from 'fs';
import { Readable } from 'stream';

import { CommandService } from '@travetto/command';
import { ExecUtil, StreamUtil, PathUtil, EnvUtil } from '@travetto/boot';

/**
 * Image output options
 */
export interface ImageOptions {
  /**
   * New height
   */
  h?: number;
  /**
   * New width
   */
  w?: number;
  /**
   * Should the image be optimized?
   */
  optimize?: boolean;
}

type ImageType = Readable | Buffer;

/**
 * Simple support for image manipulation.  Built upon @travetto/command, it can
 * run imagemagick and pngquant locally or via docker as needed.
 */
class $ImageConverter {

  /**
   * Resize/conversion util
   */
  CONVERTER = new CommandService({
    containerImage: ' jameskyburz/graphicsmagick-alpine:v1.0.0',
    localCheck: ['gm', ['-version']]
  });

  /**
   * Compressor
   */
  PNG_COMPRESSOR = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  /**
   * Compressor
   */
  JPEG_COMPRESSOR = new CommandService({
    containerImage: 'shomatan/jpegoptim:1.4.4',
    localCheck: ['jpegoptim', ['-h']]
  });

  #root: string;

  constructor(root: string) {
    this.#root = PathUtil.resolveUnix(root);
    mkdirSync(root, { recursive: true });
  }

  async #openFile(path: string): Promise<fs.FileHandle> {
    return fs.open(PathUtil.joinUnix(this.#root, path.replace(/[\\/]/g, '__')));
  }

  /**
   * Resize image using imagemagick
   */
  resize(image: Readable, options: ImageOptions): Promise<Readable>;
  resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  async resize(image: ImageType, options: ImageOptions): Promise<Readable | Buffer> {
    const state = await this.CONVERTER.exec(
      'gm', 'convert', '-resize', `${options.w ?? ''}x${options.h ?? ''}`,
      '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return await ExecUtil.pipe(state, image as Buffer);
  }

  /**
   * Optimize png using pngquant
   */
  optimize(format: 'png' | 'jpeg', image: Readable): Promise<Readable>;
  optimize(format: 'png' | 'jpeg', image: Buffer): Promise<Buffer>;
  async optimize(format: 'png' | 'jpeg', image: ImageType): Promise<Readable | Buffer> {
    let stream;
    switch (format) {
      case 'png': {
        stream = await this.PNG_COMPRESSOR.exec(
          'pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
        break;
      }
      case 'jpeg': {
        stream = await this.JPEG_COMPRESSOR.exec('jpegoptim', '-m70', '-s', '--stdin', '--stdout');
        break;
      }
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return await ExecUtil.pipe(stream, image as Buffer);
  }

  /**
   * Fetch image, compress and return as buffer
   */
  async optimizeResource(rel: string): Promise<Buffer> {
    const { ResourceManager } = await import('@travetto/base');

    const pth = await ResourceManager.find(rel);
    const handle = await this.#openFile(pth);
    const exists = await handle.stat().then(() => true, () => false);

    if (!exists) {
      let stream: Buffer | Readable = await ResourceManager.readStream(rel);
      if (/[.]png$/.test(pth)) {
        stream = await this.optimize('png', stream);
      } else if (/[.]jpe?g$/i.test(pth)) {
        stream = await this.optimize('jpeg', stream);
      }
      await StreamUtil.pipe(stream, handle.createWriteStream());
    }

    const buffer = await handle.readFile();
    await handle.close();
    return buffer;
  }
}

export const ImageConverter = new $ImageConverter(
  EnvUtil.get('TRV_IMAGE_CACHE', '.trv_images')
);