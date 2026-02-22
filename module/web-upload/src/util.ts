import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

import busboy from '@fastify/busboy';

import { type WebRequest, WebCommonUtil, WebBodyUtil, WebHeaderUtil } from '@travetto/web';
import { AsyncQueue, RuntimeError, CodecUtil, Util, BinaryUtil, type BinaryType, type BinaryStream, BinaryMetadataUtil } from '@travetto/runtime';

import type { WebUploadConfig } from './config.ts';
import type { FileMap } from './types.ts';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: BinaryStream, filename?: string, field: string, contentType?: string };
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
      transform(input, encoding, callback): void {
        const chunk = CodecUtil.readChunk(input, encoding);
        read += chunk.byteLength;
        if (read > maxSize) {
          callback(new RuntimeError('File size exceeded', { category: 'data', details: { read, size: maxSize, field } }));
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
      throw new RuntimeError('No input stream provided for upload', { category: 'data' });
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
        .on('file', (field, stream, filename, _encoding, mimetype) => queue.add({ stream, filename, field, contentType: mimetype }))
        .on('limit', field => queue.throw(new RuntimeError(`File size exceeded for ${field}`, { category: 'data' })))
        .on('finish', () => queue.close())
        .on('error', (error) => queue.throw(error instanceof Error ? error : new Error(`${error}`)));

      // Upload
      void BinaryUtil.pipeline(requestBody, uploadHandler).catch(err => queue.throw(err));

      yield* queue;
    } else {
      const filename = WebHeaderUtil.parseHeaderSegment(request.headers.get('Content-Disposition')).parameters.filename;
      yield { stream: BinaryUtil.toBinaryStream(requestBody), filename, field: 'file', contentType: contentType.value };
    }
  }

  /**
   * Detect mime from request input, usually http headers
   */
  static async detectMimeTypeFromRequestInput(location?: string, contentType?: string): Promise<FileType | undefined> {
    const { Mime } = (await import('mime'));
    const otherTypes = (await import('mime/types/other.js')).default;
    const standardTypes = (await import('mime/types/standard.js')).default;
    const checker = new Mime(standardTypes, otherTypes);
    if (contentType) {
      return { ext: checker.getExtension(contentType)!, mime: contentType };
    } else if (location) {
      const mime = checker.getType(location);
      if (mime) {
        return { mime, ext: checker.getExtension(mime)! };
      }
    }
  }

  /**
   * Detect mime from the binary source
   */
  static async detectMimeTypeFromBinary(input: BinaryType): Promise<FileType | undefined> {
    let cleanup: (() => Promise<void>) | undefined;
    try {
      const { FileTypeParser } = await import('file-type');
      const { fromWebStream } = await import('strtok3');
      const parser = new FileTypeParser();
      const token = fromWebStream(BinaryUtil.toReadableStream(input));
      cleanup = (): Promise<void> => token.close();
      return await parser.fromTokenizer(token);
    } finally {
      await cleanup?.();
    }
  }

  /**
   * Get file type
   */
  static async getFileType(input: BinaryType, filename?: string, contentType?: string): Promise<FileType> {
    return (await this.detectMimeTypeFromBinary(input)) ??
      (await this.detectMimeTypeFromRequestInput(filename, contentType)) ??
      { ext: 'bin', mime: 'application/octet-stream' };
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toFile({ stream, filename, field, contentType }: UploadItem, config: Partial<WebUploadConfig>): Promise<File> {
    const uniqueDirectory = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDirectory, { recursive: true });

    filename = filename ? path.basename(filename) : `unknown_${Date.now()}`;

    const location = path.resolve(uniqueDirectory, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });
    const mimeCheck = config.matcher ??= WebCommonUtil.mimeTypeMatcher(config.types);
    const response = (): BinaryStream => createReadStream(location);

    try {
      const target = createWriteStream(location);

      await (config.maxSize ?
        pipeline(stream, this.limitWrite(config.maxSize, field), target) :
        pipeline(stream, target));

      const detected = await this.getFileType(response(), filename, contentType);

      if (!mimeCheck(detected.mime)) {
        throw new RuntimeError(`Content type not allowed: ${detected.mime}`, { category: 'data' });
      }

      if (!path.extname(filename)) {
        filename = `${filename}.${detected.ext}`;
      }

      const metadata = await BinaryMetadataUtil.compute(response, { contentType: detected.mime, filename, });
      const file = BinaryMetadataUtil.defineBlob(new File([], ''), response, metadata);
      Object.defineProperty(file, 'cleanup', {
        value: () => config.cleanupFiles !== false && fs.rm(location).catch(() => { })
      });
      return file;
    } catch (error) {
      await remove();
      throw error;
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