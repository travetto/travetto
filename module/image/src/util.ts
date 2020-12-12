import * as fs from 'fs';

import { CommandService } from '@travetto/command';
import { ExecUtil, FsUtil, StreamUtil, AppCache } from '@travetto/boot';

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

type ImageType = NodeJS.ReadableStream | Buffer;

/**
 * Simple support for image manipulation.  Built upon @travetto/command, it can
 * run imagemagick and pngquant locally or via docker as needed.
 */
export class ImageUtil {

  /**
   * Resize/conversion util
   */
  static CONVERTER = new CommandService({
    containerImage: 'v4tech/imagemagick',
    localCheck: ['convert', ['--version']]
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
  static resize(image: NodeJS.ReadableStream, options: ImageOptions): Promise<NodeJS.ReadableStream>;
  static resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  static async resize(image: ImageType, options: ImageOptions): Promise<NodeJS.ReadableStream | Buffer> {
    const state = await this.CONVERTER.exec(
      'convert', '-resize', `${options.w ?? ''}x${options.h ?? ''}`,
      '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    return await ExecUtil.pipe(state, image as Buffer);
  }

  /**
   * Optimize png usng pngquant
   */
  static optimize(format: 'png' | 'jpeg', image: NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
  static optimize(format: 'png' | 'jpeg', image: Buffer): Promise<Buffer>;
  static async optimize(format: 'png' | 'jpeg', image: ImageType): Promise<NodeJS.ReadableStream | Buffer> {
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
      let stream: Buffer | NodeJS.ReadableStream = await ResourceManager.readStream(rel);
      if (/[.]png$/.test(pth)) {
        stream = await this.optimize('png', stream);
      } else if (/[.]jpe?g$/i.test(pth)) {
        stream = await this.optimize('jpeg', stream);
      }
      await StreamUtil.writeToFile(stream, out);
    }

    return fs.promises.readFile(out);
  }
}