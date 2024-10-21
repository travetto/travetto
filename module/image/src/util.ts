import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';

import { AppError, castTo } from '@travetto/runtime';

type ImageFormat = 'jpeg' | 'png' | 'avif' | 'webp';

/**
 * Image convert options
 */
export interface ConvertOptions {
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
   * Output image format, defaults to input format
   */
  format?: ImageFormat;
}

type ImageType = Readable | Buffer | ReadableStream;

/**
 * Simple support for image manipulation.
 */
export class ImageUtil {

  /**
   * Resize image
   */
  static async convert<T extends ImageType>(image: T, options: ConvertOptions): Promise<T> {
    if (options.optimize && !options.format) {
      if (Buffer.isBuffer(image)) {
        options.format = await this.getFileType(image);
      }
      throw new AppError('Format is required for optimizing');
    }

    const { default: sharp } = await import('sharp');

    let builder = sharp();
    if (options.w || options.h) {
      const dims = [options.w, options.h].map(x => x ? Math.trunc(x) : undefined);
      const fluid = dims.some(x => !x);
      builder = builder.resize({
        width: dims[0],
        height: dims[1],
        fit: fluid ? 'inside' : 'fill'
      });
    }

    switch (options.format) {
      case 'jpeg':
        builder = builder.jpeg(options.optimize ? { quality: 80, progressive: true } : {});
        break;
      case 'png':
        builder = builder.png(options.optimize ? { compressionLevel: 9, quality: 80, adaptiveFiltering: true } : {});
        break;
      case 'avif':
        builder = builder.avif(options.optimize ? { quality: 70 } : {});
        break;
      case 'webp':
        builder = builder.webp(options.optimize ? { quality: 80 } : {});
        break;
    }

    const stream = Buffer.isBuffer(image) ? Readable.from(image) : image;
    pipeline(stream, builder);
    return castTo('pipeThrough' in image ?
      ReadableStream.from(builder) :
      Buffer.isBuffer(image) ? builder.toBuffer() : builder);
  }

  /**
   * Get Image Dimensions
   */
  static async getDimensions(image: Buffer | string): Promise<{ width: number, height: number, aspect: number }> {
    const { default: sharp } = await import('sharp');
    return sharp(image).metadata().then(v => ({ width: v.width!, height: v.height!, aspect: v.width! / v.height! }));
  }

  /**
   * Get image type
   */
  static async getFileType(image: Buffer | string): Promise<ImageFormat> {
    const { default: sharp } = await import('sharp');
    return sharp(image).metadata().then(v =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      v.format?.replace('heif', 'avif')! as ImageFormat
    );
  }
}
