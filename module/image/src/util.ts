import * as fs from 'fs/promises';
import { Readable } from 'stream';

import { CommandService } from '@travetto/command';
import { ExecUtil, StreamUtil, AppCache, FsUtil } from '@travetto/boot';

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
export class ImageUtil {

  /**
   * Resize/conversion util
   */
  static CONVERTER = new CommandService({
    containerImage: ' jameskyburz/graphicsmagick-alpine:v1.0.0',
    localCheck: ['gm', ['-version']]
  });

  /**
   * Compressor
   */
  static PNG_COMPRESSOR = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  /**
   * Compressor
   */
  static JPEG_COMPRESSOR = new CommandService({
    containerImage: 'shomatan/jpegoptim:1.4.4',
    localCheck: ['jpegotim', ['-h']]
  });

  /**
   * Resize image using image magick
   */
  static resize(image: Readable, options: ImageOptions): Promise<Readable>;
  static resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  static async resize(image: ImageType, options: ImageOptions): Promise<Readable | Buffer> {
    const state = await this.CONVERTER.exec(
      'gm', 'convert', '-resize', `${options.w ?? ''}x${options.h ?? ''}`,
      '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    return await ExecUtil.pipe(state, image as Buffer);
  }

  /**
   * Optimize png usng pngquant
   */
  static optimize(format: 'png' | 'jpeg', image: Readable): Promise<Readable>;
  static optimize(format: 'png' | 'jpeg', image: Buffer): Promise<Buffer>;
  static async optimize(format: 'png' | 'jpeg', image: ImageType): Promise<Readable | Buffer> {
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
    return await ExecUtil.pipe(stream, image as Buffer);
  }

  /**
   * Fetch image, compress and return as buffer
   */
  static async optimizeResource(rel: string) {
    const { ResourceManager } = await import('@travetto/base');

    const pth = await ResourceManager.find(rel);
    const out = AppCache.toEntryName(pth);

    if (!(await FsUtil.exists(out))) {
      let stream: Buffer | Readable = await ResourceManager.readStream(rel);
      if (/[.]png$/.test(pth)) {
        stream = await this.optimize('png', stream);
      } else if (/[.]jpe?g$/i.test(pth)) {
        stream = await this.optimize('jpeg', stream);
      }
      await StreamUtil.writeToFile(stream, out);
    }

    return fs.readFile(out);
  }
}