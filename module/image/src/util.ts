import { CommandService } from '@travetto/exec';
import { SystemUtil } from '@travetto/base';

export interface ImageOptions {
  h?: number;
  w?: number;
  optimize?: boolean;
}

type ImageType = NodeJS.ReadableStream | Buffer | string;

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
  static async runCommand(svc: CommandService, image: string | NodeJS.ReadableStream, cmd: string, ...args: string[]): Promise<NodeJS.ReadableStream>;
  static async runCommand(svc: CommandService, image: ImageType, cmd: string, ...args: string[]): Promise<NodeJS.ReadableStream | Buffer> {
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
      stream.on = stream.addListener = function (this: NodeJS.ReadableStream, type: string, handler: Function) {
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

  static resize(image: string | NodeJS.ReadableStream, options: ImageOptions): Promise<NodeJS.ReadableStream>;
  static resize(image: Buffer, options: ImageOptions): Promise<Buffer>;
  static resize(image: ImageType, options: ImageOptions): Promise<NodeJS.ReadableStream | Buffer> {
    return this.runCommand(this.converter, image as any,
      'convert', '-resize', `${options.w ?? ''}X${options.h ?? ''}`, '-auto-orient', ...(options.optimize ? ['-strip', '-quality', '86'] : []), '-', '-');
  }

  static optimizePng(image: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
  static optimizePng(image: Buffer): Promise<Buffer>;
  static optimizePng(image: ImageType): Promise<NodeJS.ReadableStream | Buffer> {
    return this.runCommand(this.pngCompressor, image as any,
      'pngquant', '--quality', '40-80', '--speed', '1', '--force', '-');
  }
}