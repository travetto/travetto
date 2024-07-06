import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';
import { createReadStream } from 'node:fs';
import { ChildProcess } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

import { CommandOperation } from '@travetto/command';

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

  static async #stream<T extends ImageType>(proc: ChildProcess, input: T): Promise<T> {
    if (Buffer.isBuffer(input)) {
      const [_, output] = await Promise.all([
        pipeline(Readable.from(input), proc.stdin!),
        toBuffer(proc.stdout!)
      ]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return output as T;
    } else {
      input.pipe(proc.stdin!); // Start the process
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return proc.stdout! as T;
    }
  }

  /**
   * Resize image using imagemagick
   */
  static async resize<T extends ImageType>(image: T, options: ImageOptions): Promise<T> {
    const dims = [options.w, options.h].map(d => (d && options.strictResolution !== false) ? `${d}!` : d).join('x');

    const proc = await this.CONVERTER.exec(
      'gm', 'convert', '-resize', dims, '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    return this.#stream(proc, image);
  }

  /**
   * Optimize png using pngquant
   */
  static async optimize<T extends ImageType>(format: 'png' | 'jpeg', image: T): Promise<T> {
    let proc: ChildProcess;
    switch (format) {
      case 'png': {
        proc = await this.PNG_COMPRESSOR.exec(
          'pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
        break;
      }
      case 'jpeg': {
        proc = await this.JPEG_COMPRESSOR.exec('jpegoptim', '-m70', '-s', '--stdin', '--stdout');
        break;
      }
    }
    return this.#stream(proc, image);
  }

  /**
   * Get Image Dimensions
   * @param image
   */
  static async getDimensions(image: Readable | Buffer | string): Promise<{ width: number, height: number }> {
    const proc = await this.CONVERTER.exec(
      'gm', 'identify', '-format', '%wX%h', '-',
    );

    if (typeof image === 'string') {
      image = createReadStream(image);
    }

    const [_, output] = await Promise.all([
      pipeline(image, proc.stdin!),
      toBuffer(proc.stdout!)
    ]);

    const text = output.toString('utf8');
    const [w, h] = text.split('X').map(x => parseFloat(x));

    return { width: w, height: h };
  }
}
