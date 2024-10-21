import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';

import type { Sharp } from 'sharp';

import { castTo } from '@travetto/runtime';

type ImageFormat = 'jpeg' | 'png' | 'avif' | 'webp';

/**
 * Image resize options
 */
export interface ResizeOptions {
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

/**
 * Image optimize options
 */
export interface OptimizeOptions {
  format?: ImageFormat;
}


type ImageType = Readable | Buffer | ReadableStream;

/**
 * Simple support for image manipulation.
 */
export class ImageUtil {

  static async #sharpReturn<T extends ImageType>(output: Sharp, input: T, optimize?: boolean, format?: ImageFormat): Promise<T> {
    output = output
      .jpeg({ ...(optimize ? { quality: 80, progressive: true } : {}), force: format === 'jpeg' })
      .png({ ...(optimize ? { compressionLevel: 9, quality: 80, adaptiveFiltering: true } : {}), force: format === 'png' })
      .avif({ ...(optimize ? { quality: 70 } : {}), force: format === 'avif' })
      .webp({ ...(optimize ? { quality: 80 } : {}), force: format === 'webp' });
    const stream = Buffer.isBuffer(input) ? Readable.from(input) : input;
    pipeline(stream, output);
    return castTo('pipeThrough' in input ? ReadableStream.from(output) : Buffer.isBuffer(input) ? output.toBuffer() : output);
  }

  /**
   * Resize image
   */
  static async resize<T extends ImageType>(image: T, options: ResizeOptions = {}): Promise<T> {
    const dims = [options.w, options.h].map(x => x ? Math.trunc(x) : undefined);
    const fluid = dims.some(x => !x);

    const { default: sharp } = await import('sharp');

    return this.#sharpReturn(
      sharp().resize({
        width: dims[0],
        height: dims[1],
        fit: fluid ? 'inside' : 'fill'
      }),
      image,
      options.optimize,
      options.format
    );
  }

  /**
   * Optimize an image
   */
  static async optimize<T extends ImageType>(image: T, options: OptimizeOptions = {}): Promise<T> {
    const { default: sharp } = await import('sharp');
    return this.#sharpReturn(sharp(), image, true, options.format);
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
  static async getFileType(image: Buffer | string): Promise<string> {
    const { default: sharp } = await import('sharp');
    return sharp(image).metadata().then(v => v.format?.replace('heif', 'avif')!);
  }
}
