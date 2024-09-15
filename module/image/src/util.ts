import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { buffer as toBuffer } from 'node:stream/consumers';
import { ChildProcess } from 'node:child_process';

import type { Sharp } from 'sharp';

import { CommandOperation } from '@travetto/command';
import { castTo } from '@travetto/runtime';

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
   * Sub process, allows for externalization of memory
   */
  asSubprocess?: boolean;
}

/**
 * Image optimize options
 */
export interface OptimizeOptions {
  format?: 'png' | 'jpeg';
  /**
   * Sub process, allows for externalization of memory
   */
  asSubprocess?: boolean;
}


type ImageType = Readable | Buffer | ReadableStream;

/**
 * Simple support for image manipulation.
 */
export class ImageUtil {

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
    containerImage: 'agregad/pngquant:latest',
    localCheck: ['pngquant', ['-h']]
  });

  /**
   * Compressor
   */
  static JPEG_COMPRESSOR = new CommandOperation({
    containerImage: 'shomatan/jpegoptim:1.4.4',
    localCheck: ['jpegoptim', ['-h']]
  });

  static async #subprocessReturn<T extends ImageType>(proc: ChildProcess, input: T): Promise<T> {
    if (Buffer.isBuffer(input)) {
      const [, buffer] = await Promise.all([
        pipeline(Readable.from(input), proc.stdin!),
        toBuffer(proc.stdout!)
      ]);
      return castTo(buffer);
    } else {
      pipeline(castTo<Readable>(input), proc.stdin!);
      return castTo('pipeThrough' in input ? ReadableStream.from(proc.stdout!) : proc.stdout);
    }
  }

  static async #sharpReturn<T extends ImageType>(output: Sharp, input: T, optimize?: boolean, format?: 'jpeg' | 'png'): Promise<T> {
    if (optimize) {
      output = output
        .jpeg({ quality: 80, progressive: true, force: format === 'jpeg' })
        .png({ compressionLevel: 9, quality: 80, adaptiveFiltering: true, force: format === 'png' });
    }
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

    if (options.asSubprocess) {
      return this.#subprocessReturn(
        await this.CONVERTER.exec('gm', 'convert', '-resize', dims.map(x => x || '').join('x'), '-auto-orient',
          ...(options.optimize ? ['-strip', '-quality', '86'] : []), '-', '-'),
        image);
    } else {
      const { default: sharp } = await import('sharp');

      return this.#sharpReturn(
        sharp().resize({
          width: dims[0],
          height: dims[1],
          fit: fluid ? 'inside' : 'fill'
        }),
        image,
        options.optimize,
      );
    }
  }

  /**
   * Optimize an image
   */
  static async optimize<T extends ImageType>(image: T, options: OptimizeOptions = {}): Promise<T> {
    if (options.asSubprocess) {
      switch (options.format) {
        case 'png': return this.#subprocessReturn(
          await this.PNG_COMPRESSOR.exec('pngquant', '--quality', '40-80', '--speed', '1', '--force', '-'), image);
        default:
        case 'jpeg': return this.#subprocessReturn(
          await this.JPEG_COMPRESSOR.exec('jpegoptim', '-m70', '-s', '--stdin', '--stdout', '-'), image);
      }
    } else {
      const { default: sharp } = await import('sharp');
      return this.#sharpReturn(sharp(), image, true, options.format);
    }
  }

  /**
   * Get Image Dimensions
   */
  static async getDimensions(image: Buffer | string): Promise<{ width: number, height: number, aspect: number }> {
    const { default: sharp } = await import('sharp');
    return sharp(image).metadata().then(v => ({ width: v.width!, height: v.height!, aspect: v.width! / v.height! }));
  }
}
