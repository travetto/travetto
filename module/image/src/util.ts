import { CommandService } from '@travetto/exec';
import { SystemUtil } from '@travetto/base';
import { Readable } from 'stream';

export interface ImageOptions {
  h?: number;
  w?: number;
}

type ImageType = Readable | Buffer | string;

export class ImageUtil {

  static converter = new CommandService({
    containerImage: 'v4tech/imagemagick',
    localCheck: ['convert', ['--version']]
  });

  static pngCompressor = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  static async runCommand(svc: CommandService, image: Buffer, cmd: string, ...args: string[]): Promise<Buffer>;
  static async runCommand(svc: CommandService, image: string | Readable, cmd: string, ...args: string[]): Promise<Readable>;
  static async runCommand(svc: CommandService, image: ImageType, cmd: string, ...args: string[]): Promise<Readable | Buffer> {
    const { process: proc, result: prom } = await svc.exec(cmd, ...args);
    SystemUtil.toReadable(image).pipe(proc.stdin!);
    if (image instanceof Buffer) {
      const outBuffer = SystemUtil.toBuffer(proc.stdout!);
      await prom;
      return outBuffer;
    } else {
      const stream = proc.stdout!; // Stream if requesting stream
      const ogListen = stream.addListener;

      // Allow for process to end before calling end handler
      stream.on = stream.addListener = function (this: Readable, type: string, handler: Function) {
        let outHandler = handler;
        if (type === 'end') {
          outHandler = async (...params: any[]) => {
            await prom;
            handler(...params);
          };
        }
        return ogListen.call(this, type, outHandler as any);
      };
      return stream;
    }
  }

  static resize(image: string | Readable, options: ImageOptions): Promise<Readable>;
  static resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  static resize(image: ImageType, options: ImageOptions): Promise<Readable | Buffer> {
    return this.runCommand(this.converter, image as any,
      'convert', '-resize', `${options.w}x${options.h}`, '-auto-orient', '-', '-');
  }

  static optimizePng(image: string | Readable): Promise<Readable>;
  static optimizePng(image: Buffer): Promise<Buffer>;
  static optimizePng(image: ImageType): Promise<Readable | Buffer> {
    return this.runCommand(this.pngCompressor, image as any,
      'pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
  }
}