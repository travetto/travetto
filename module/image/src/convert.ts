import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';

import { CommandOperation } from '@travetto/command';
import { StreamUtil } from '@travetto/base';

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
  /**
   * Strict resolution
   */
  strictResolution?: boolean;
}

type ImageType = Readable | Buffer;

/**
 * Simple support for image manipulation.  Built upon @travetto/command, it can
 * run imagemagick and pngquant locally or via docker as needed.
 */
export class ImageConverter {

  /**
   * Resize/conversion util
   */
  static CONVERTER = new CommandOperation({
    containerImage: 'jameskyburz/graphicsmagick-alpine:v1.0.0',
    localCheck: ['gm', ['-version']]
  });

  /**
   * Compressor
   */
  static PNG_COMPRESSOR = new CommandOperation({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  /**
   * Compressor
   */
  static JPEG_COMPRESSOR = new CommandOperation({
    containerImage: 'shomatan/jpegoptim:1.4.4',
    localCheck: ['jpegoptim', ['-h']]
  });

  /**
   * Resize image using imagemagick
   */
  static async resize<T extends ImageType>(image: T, options: ImageOptions): Promise<T> {
    const dims = [options.w, options.h].map(d => (d && options.strictResolution !== false) ? `${d}!` : d).join('x');

    const state = await this.CONVERTER.exec(
      'gm', 'convert', '-resize', dims, '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    return await StreamUtil.execPipe(state, image);
  }

  /**
   * Optimize png using pngquant
   */
  static async optimize<T extends ImageType>(format: 'png' | 'jpeg', image: T): Promise<T> {
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
    return await StreamUtil.execPipe(stream, image);
  }

  /**
   * Get Image Dimensions
   * @param image
   */
  static async getDimensions(image: Readable | Buffer | string): Promise<{ width: number, height: number }> {
    const state = await this.CONVERTER.exec(
      'gm', 'identify', '-format', '%wX%h', '-',
    );

    if (typeof image === 'string') {
      image = createReadStream(image);
    }

    await StreamUtil.execPipe(state, await StreamUtil.toStream(image));

    const buf = await StreamUtil.toBuffer(state.process.stdout!);
    const text = buf.toString('utf8');
    const [w, h] = text.split('X').map(x => parseFloat(x));

    return { width: w, height: h };
  }
}
