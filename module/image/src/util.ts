import { CommandService } from '@travetto/exec';
import { ExecUtil } from '@travetto/boot';

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

type ImageType = NodeJS.ReadableStream | Buffer | string;

/**
 * Simple support for image manipulation.  Built upon @travetto/exec, it can
 * run imagemagick and pngquant locally or via docker as needed.
 */
export class ImageUtil {

  /**
   * Resize/conversion util
   */
  static converter = new CommandService({
    containerImage: 'v4tech/imagemagick',
    localCheck: ['convert', ['--version']]
  });

  /**
   * Compressor
   */
  static pngCompressor = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  /**
   * Resize image using image magick
   */
  static resize(image: string | NodeJS.ReadableStream, options: ImageOptions): Promise<NodeJS.ReadableStream>;
  static resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  static async resize(image: ImageType, options: ImageOptions): Promise<NodeJS.ReadableStream | Buffer> {
    const state = await this.converter.exec(
      'convert', '-resize', `
      ${options.w ?? ''}X${options.h ?? ''}`,
      '-auto-orient',
      ...(options.optimize ? ['-strip', '-quality', '86'] : []),
      '-', '-');

    return await ExecUtil.pipe(state, image as Buffer);
  }

  /**
   * Optimize png usng pngquant
   */
  static optimizePng(image: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
  static optimizePng(image: Buffer): Promise<Buffer>;
  static async optimizePng(image: ImageType): Promise<NodeJS.ReadableStream | Buffer> {
    const state = await this.pngCompressor.exec(
      'pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
    return await ExecUtil.pipe(state, image as Buffer);
  }
}