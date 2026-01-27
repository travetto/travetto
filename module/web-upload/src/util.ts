import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

import busboy from '@fastify/busboy';

import { type WebRequest, WebCommonUtil, WebBodyUtil, WebHeaderUtil } from '@travetto/web';
import { AsyncQueue, AppError, Util, BinaryUtil, type BinaryType, type BinaryStream, CodecUtil, BinaryBlob } from '@travetto/runtime';

import type { WebUploadConfig } from './config.ts';
import type { UploadMap } from './types.ts';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: BinaryStream, filename?: string, field: string };
type FileType = { ext: string, mime: string };
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
        read += (typeof chunk === 'string' ? chunk.length : BinaryUtil.isBinaryArray(chunk) ? chunk.byteLength : 0);
        if (read > maxSize) {
          callback(new AppError('File size exceeded', { category: 'data', details: { read, size: maxSize, field } }));
        } else {
          callback(null, chunk);
        }
      },
    });
  }

  /**
   * Get all the uploads, separating multipart from direct
   */
  static async * getUploads(request: WebRequest, config: Partial<WebUploadConfig>): AsyncIterable<UploadItem> {
    if (!WebBodyUtil.isRawBinary(request.body)) {
      throw new AppError('No input stream provided for upload', { category: 'data' });
    }

    const requestBody = request.body;
    request.body = undefined;

    const contentType = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Type'));

    if (MULTIPART.has(contentType.value)) {
      const fileMaxes = Object.values(config.uploads ?? {})
        .map(uploadConfig => uploadConfig.maxSize)
        .filter(uploadConfig => uploadConfig !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
      const queue = new AsyncQueue<UploadItem>();

      const uploadHandler = busboy({
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
        .on('error', (error) => queue.throw(error instanceof Error ? error : new Error(`${error}`)));

      // Upload
      BinaryUtil.pipeline(requestBody, uploadHandler).catch(err => queue.throw(err));

      yield* queue;
    } else {
      const filename = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Disposition')).parameters.filename;
      yield { stream: BinaryUtil.toBinaryStream(requestBody), filename, field: 'file' };
    }
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toBinaryBlob({ stream, filename, field }: UploadItem, config: Partial<WebUploadConfig>): Promise<BinaryBlob> {
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

      const detected = await this.getFileType(createReadStream(location), location);

      if (!mimeCheck(detected.mime)) {
        throw new AppError(`Content type not allowed: ${detected.mime}`, { category: 'data' });
      }

      if (!path.extname(filename)) {
        filename = `${filename}.${detected.ext}`;
      }

      return new BinaryBlob(() => createReadStream(location), {
        contentType: detected.mime,
        filename,
        hash: await CodecUtil.hash(createReadStream(location), { hashAlgorithm: 'sha256' }),
        size: (await fs.stat(location)).size,
        rawLocation: location
      });
    } catch (error) {
      await remove();
      throw error;
    }
  }

  /**
   * Get file type
   */
  static async getFileType(input: BinaryType, filename: string): Promise<FileType> {
    const { FileTypeParser } = await import('file-type');
    const { fromStream } = await import('strtok3');

    const parser = new FileTypeParser();
    let token: ReturnType<typeof fromStream> | undefined;
    let matched: FileType | undefined;

    try {
      token = await fromStream(BinaryUtil.toReadable(input));
      matched = await parser.fromTokenizer(token);
    } finally {
      await token?.close();
    }

    if (!matched && filename) {
      const { Mime } = (await import('mime'));
      const otherTypes = (await import('mime/types/other.js')).default;
      const standardTypes = (await import('mime/types/standard.js')).default;
      const checker = new Mime(standardTypes, otherTypes);
      const mime = checker.getType(filename);
      if (mime) {
        return { ext: checker.getExtension(mime)!, mime };
      }
    }
    return matched ?? { ext: 'bin', mime: 'application/octet-stream' };
  }

  /**
   * Finish upload
   */
  static async finishUpload(upload: BinaryBlob, config: Partial<WebUploadConfig>): Promise<void> {
    if (config.cleanupFiles !== false) {
      await fs.rm(upload.metadata.rawLocation!, { force: true });
    }
  }

  /**
   * Get Uploads
   */
  static getRequestUploads(request: WebRequest & { [WebUploadSymbol]?: UploadMap }): UploadMap {
    return request[WebUploadSymbol] ?? {};
  }

  /**
   * Set Uploads
   */
  static setRequestUploads(request: WebRequest & { [WebUploadSymbol]?: UploadMap }, uploads: UploadMap): void {
    request[WebUploadSymbol] ??= uploads;
  }
}