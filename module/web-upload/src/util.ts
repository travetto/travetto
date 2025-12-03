import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

import busboy from '@fastify/busboy';

import { WebRequest, WebCommonUtil, WebBodyUtil, WebHeaderUtil } from '@travetto/web';
import { AsyncQueue, AppError, castTo, Util, BinaryUtil } from '@travetto/runtime';

import { WebUploadConfig } from './config.ts';
import { FileMap } from './types.ts';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: Readable, filename?: string, field: string };
type FileType = { ext: string, mime: string };
const RawFileSymbol = Symbol();
const WebUploadSymbol = Symbol();

/**
 * Web upload utilities
 */
export class WebUploadUtil {

  /**
   * Write limiter
   * @returns
   */
  static limitWrite(maxSize: number, field?: string): Transform {
    let read = 0;
    return new Transform({
      transform(chunk, encoding, callback): void {
        read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : (chunk instanceof Uint8Array ? chunk.byteLength : 0);
        if (read > maxSize) {
          callback(new AppError('File size exceeded', { category: 'data', details: { read, size: maxSize, field } }));
        } else {
          callback(null, chunk);
        }
      },
    });
  }

  /**
   * Get uploaded file path location
   */
  static getUploadLocation(file: File): string {
    return castTo<{ [RawFileSymbol]: string }>(file)[RawFileSymbol];
  }

  /**
   * Get all the uploads, separating multipart from direct
   */
  static async* getUploads(request: WebRequest, config: Partial<WebUploadConfig>): AsyncIterable<UploadItem> {
    if (!WebBodyUtil.isRaw(request.body)) {
      throw new AppError('No input stream provided for upload', { category: 'data' });
    }

    const bodyStream = Buffer.isBuffer(request.body) ? Readable.from(request.body) : request.body;
    request.body = undefined;

    const contentType = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Type'));

    if (MULTIPART.has(contentType.value)) {
      const fileMaxes = Object.values(config.uploads ?? {})
        .map(uploadConfig => uploadConfig.maxSize)
        .filter(uploadConfig => uploadConfig !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
      const queue = new AsyncQueue<UploadItem>();

      // Upload
      bodyStream.pipe(busboy({
        headers: {
          'content-type': request.headers.get('Content-Type')!,
          'content-disposition': request.headers.get('Content-Disposition')!,
          'content-length': request.headers.get('Content-Length')!,
          'content-range': request.headers.get('Content-Range')!,
          'content-encoding': request.headers.get('Content-Encoding')!,
          'content-transfer-encoding': request.headers.get('Content-Transfer-Encoding')!,
        },
        limits: { fileSize: largestMax }
      })
        .on('file', (field, stream, filename) => queue.add({ stream, filename, field }))
        .on('limit', field => queue.throw(new AppError(`File size exceeded for ${field}`, { category: 'data' })))
        .on('finish', () => queue.close())
        .on('error', (error) => queue.throw(error instanceof Error ? error : new Error(`${error}`))));

      yield* queue;
    } else {
      const filename = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Disposition')).parameters.filename;
      yield { stream: bodyStream, filename, field: 'file' };
    }
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toFile({ stream, filename, field }: UploadItem, config: Partial<WebUploadConfig>): Promise<File> {
    const uniqueDirectory = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDirectory, { recursive: true });

    filename = filename ? path.basename(filename) : `unknown_${Date.now()}`;

    const location = path.resolve(uniqueDirectory, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });
    const mimeCheck = config.matcher ??= WebCommonUtil.mimeTypeMatcher(config.types);

    try {
      const target = createWriteStream(location);

      await (config.maxSize ?
        pipeline(stream, this.limitWrite(config.maxSize, field), target) :
        pipeline(stream, target));

      const detected = await this.getFileType(location);

      if (!mimeCheck(detected.mime)) {
        throw new AppError(`Content type not allowed: ${detected.mime}`, { category: 'data' });
      }

      if (!path.extname(filename)) {
        filename = `${filename}.${detected.ext}`;
      }

      const file = BinaryUtil.readableBlob(() => createReadStream(location), {
        contentType: detected.mime,
        filename,
        hash: await BinaryUtil.hashInput(createReadStream(location)),
        size: (await fs.stat(location)).size,
      });

      Object.assign(file, { [RawFileSymbol]: location });

      return file;
    } catch (error) {
      await remove();
      throw error;
    }
  }

  /**
   * Get file type
   */
  static async getFileType(input: string | Readable): Promise<FileType> {
    const { FileTypeParser } = await import('file-type');
    const { fromStream } = await import('strtok3');

    const parser = new FileTypeParser();
    let token: ReturnType<typeof fromStream> | undefined;
    let matched: FileType | undefined;

    try {
      token = await fromStream(typeof input === 'string' ? createReadStream(input) : input);
      matched = await parser.fromTokenizer(token);
    } finally {
      await token?.close();
    }

    if (!matched && typeof input === 'string') {
      const { Mime } = (await import('mime'));
      const otherTypes = (await import('mime/types/other.js')).default;
      const standardTypes = (await import('mime/types/standard.js')).default;
      const checker = new Mime(standardTypes, otherTypes);
      const mime = checker.getType(input);
      if (mime) {
        return { ext: checker.getExtension(mime)!, mime };
      }
    }
    return matched ?? { ext: 'bin', mime: 'application/octet-stream' };
  }

  /**
   * Finish upload
   */
  static async finishUpload(upload: File, config: Partial<WebUploadConfig>): Promise<void> {
    if (config.cleanupFiles !== false) {
      await fs.rm(this.getUploadLocation(upload), { force: true });
    }
  }

  /**
   * Get Uploads
   */
  static getRequestUploads(request: WebRequest & { [WebUploadSymbol]?: FileMap }): FileMap {
    return request[WebUploadSymbol] ?? {};
  }

  /**
   * Set Uploads
   */
  static setRequestUploads(request: WebRequest & { [WebUploadSymbol]?: FileMap }, uploads: FileMap): void {
    request[WebUploadSymbol] ??= uploads;
  }
}