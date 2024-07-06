import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import sharp from 'sharp';

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
 * Simple support for image manipulation.
 */
export class ImageConverter {

  /**
   * Resize image
   */
  static async resize<T extends ImageType>(image: T, options: ImageOptions): Promise<T> {
    const dims = [options.w, options.h].map(d => (d && options.strictResolution !== false) ? d : d);
    const pipe = (Buffer.isBuffer(image) ? sharp(image) : sharp())
      .resize({ width: dims[0], height: dims[1], fit: options.strictResolution !== false ? 'fill' : 'inside' });

    if (Buffer.isBuffer(image)) {
      return pipe.toBuffer() as Promise<T>;
    } else {
      pipeline(image, pipe);
      return pipe as unknown as Promise<T>;
    }
  }

  /**
   * Optimize png using pngquant
   */
  static async optimize<T extends ImageType>(format: 'png' | 'jpeg', image: T): Promise<T> {
    switch (format) {
      case 'png': {
        if (Buffer.isBuffer(image)) {
          return sharp(image).toFormat('png', { quality: 80, }).toBuffer() as Promise<T>
        } else {
          const pipe = sharp().toFormat('png', { quality: 80, });
          pipeline(image, pipe);
          return pipe as unknown as Promise<T>;
        }
      }
      case 'jpeg': {
        if (Buffer.isBuffer(image)) {
          return sharp(image).toFormat('jpg', { quality: 70, }).toBuffer() as Promise<T>
        } else {
          const pipe = sharp().toFormat('jpg', { quality: 70 });
          pipeline(image, pipe);
          return pipe as unknown as Promise<T>;
        }
      }
    }
  }

  /**
   * Get Image Dimensions
   * @param image
   */
  static async getDimensions(image: Buffer | string): Promise<{ width: number, height: number }> {
    return sharp(image).metadata().then(v => ({ width: v.width!, height: v.height! }));
  }
}
