import type { Metadata, Sharp } from 'sharp';

import { BinaryUtil, castTo, type BinaryStream, type BinaryType } from '@travetto/runtime';

const VALID_EXTENSIONS = ['jpeg', 'jpg', 'png', 'avif', 'webp', 'gif', 'jxl'] as const;

type ImageFormat = typeof VALID_EXTENSIONS[number];
type ImageMetadata = {
  width: number;
  height: number;
  aspect: number;
  format: ImageFormat;
};

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

  static isKnownExtension(ext: string): ext is ImageFormat {
    return VALID_EXTENSIONS.includes(castTo(ext));
  }

  static async #getBuilder({ format, optimize, ...options }: ConvertOptions): Promise<Sharp> {
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

    return builder
      .avif({ force: format === 'avif', ...optimize ? { quality: 70 } : {} })
      .webp({ force: format === 'webp', ...optimize ? { quality: 80 } : {} })
      .png({ force: format === 'png', ...optimize ? { compressionLevel: 9, quality: 80, adaptiveFiltering: true } : {} })
      .jpeg({ force: format === 'jpeg' || format === 'jpg', ...optimize ? { quality: 80, progressive: true } : {} })
      .jxl({ force: format === 'jxl', ...optimize ? { lossless: false, quality: 80 } : {} })
      .gif({ force: format === 'gif', ...optimize ? { effort: 10 } : {} });

  }

  /**
   * Convert image as readable stream
   */
  static async convert(image: BinaryType, options: ConvertOptions): Promise<BinaryStream> {
    const builder = await this.#getBuilder(options);
    BinaryUtil.pipeline(image, builder);
    return builder;
  }

  /**
   * Get Image metadata
   */
  static async getMetadata(image: BinaryType): Promise<ImageMetadata> {
    const { default: sharp } = await import('sharp');
    const out = await new Promise<Metadata>((resolve, reject) =>
      BinaryUtil.pipeline(image, sharp().metadata((error, metadata) => error ? reject(error) : resolve(metadata)))
    );
    return {
      width: out.width!,
      height: out.height!,
      format: castTo(out.format?.replace('heif', 'avif')!),
      aspect: out.width! / out.height!
    };
  }
}
