import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

import busboy from '@fastify/busboy';

import { WebRequest, MimeUtil, WebBodyUtil } from '@travetto/web';
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
    const bodyStream = WebBodyUtil.getRawStream(request.body);

    if (!bodyStream) {
      throw new AppError('No input stream provided for upload', { category: 'data' });
    }

    request.body = undefined;

    if (MULTIPART.has(request.headers.getContentType()?.full!)) {
      const fileMaxes = Object.values(config.uploads ?? {}).map(x => x.maxSize).filter(x => x !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
      const itr = new AsyncQueue<UploadItem>();

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
        .on('file', (field, stream, filename) => itr.add({ stream, filename, field }))
        .on('limit', field => itr.throw(new AppError(`File size exceeded for ${field}`, { category: 'data' })))
        .on('finish', () => itr.close())
        .on('error', (err) => itr.throw(err instanceof Error ? err : new Error(`${err}`))));

      yield* itr;
    } else {
      yield { stream: bodyStream, filename: request.headers.getFilename(), field: 'file' };
    }
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toFile({ stream, filename, field }: UploadItem, config: Partial<WebUploadConfig>): Promise<File> {
    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });

    filename = filename ? path.basename(filename) : `unknown_${Date.now()}`;

    const location = path.resolve(uniqueDir, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });
    const mimeCheck = config.matcher ??= MimeUtil.matcher(config.types);

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
    } catch (err) {
      await remove();
      throw err;
    }
  }

  /**
   * Get file type
   */
  static async getFileType(input: string | Readable): Promise<FileType> {
    const { FileTypeParser } = await import('file-type');
    const { fromStream } = await import('strtok3');

    const parser = new FileTypeParser();
    let tok: ReturnType<typeof fromStream> | undefined;
    let matched: FileType | undefined;

    try {
      tok = await fromStream(typeof input === 'string' ? createReadStream(input) : input);
      matched = await parser.fromTokenizer(tok);
    } finally {
      await tok?.close();
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