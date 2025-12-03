import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import type { Metadata } from 'sharp';

import { castTo } from '@travetto/runtime';

type ImageFormat = 'jpeg' | 'png' | 'avif' | 'webp' | 'gif' | 'jxl';
type Input = Buffer | string | ReadableStream | Readable;

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

/**
 * Simple support for image manipulation.
 */
export class ImageUtil {

  /**
   * Convert image
   */
  static async convert<T extends Input>(image: T, { format, optimize, ...options }: ConvertOptions): Promise<T extends string ? Readable : T> {
    const { default: sharp } = await import('sharp');

    let builder = sharp();
    if (options.w || options.h) {
      const dims = [options.w, options.h].map(value => value ? Math.trunc(value) : undefined);
      const fluid = dims.some(value => !value);
      builder = builder.resize({
        width: dims[0],
        height: dims[1],
        fit: fluid ? 'inside' : 'fill'
      });
    }

    builder = builder
      .avif({ force: format === 'avif', ...optimize ? { quality: 70 } : {} })
      .webp({ force: format === 'webp', ...optimize ? { quality: 80 } : {} })
      .png({ force: format === 'png', ...optimize ? { compressionLevel: 9, quality: 80, adaptiveFiltering: true } : {} })
      .jpeg({ force: format === 'jpeg', ...optimize ? { quality: 80, progressive: true } : {} })
      .jxl({ force: format === 'jxl', ...optimize ? { lossless: false, quality: 80 } : {} })
      .gif({ force: format === 'gif', ...optimize ? { effort: 10 } : {} });

    const stream = Buffer.isBuffer(image) ?
      Readable.from(image) :
      (typeof image === 'string' ? createReadStream(image) : image);

    pipeline(stream, builder);
    return castTo(
      typeof image === 'string' ?
        builder : Buffer.isBuffer(image) ?
          builder.toBuffer() :
          (image instanceof ReadableStream) ?
            ReadableStream.from(builder) : builder
    );
  }

  /**
   * Get Image metadata
   */
  static async getMetadata(image: Input): Promise<{
    width: number;
    height: number;
    aspect: number;
    format: ImageFormat;
  }> {
    const { default: sharp } = await import('sharp');
    const out = await ((Buffer.isBuffer(image) || typeof image === 'string') ?
      sharp(image).metadata() :
      new Promise<Metadata>((resolve, reject) =>
        pipeline(image, sharp().metadata((error, metadata) => error ? reject(error) : resolve(metadata)))
      ));
    return {
      width: out.width!,
      height: out.height!,
      format: castTo(out.format?.replace('heif', 'avif')!),
      aspect: out.width! / out.height!
    };
  }
}
