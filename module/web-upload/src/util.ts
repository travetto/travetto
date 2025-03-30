import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import busboy from '@fastify/busboy';

import { HttpRequest, MimeUtil } from '@travetto/web';
import { AsyncQueue, AppError, castTo, Util, BinaryUtil } from '@travetto/runtime';

import { WebUploadConfig } from './config.ts';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: Readable, filename?: string, field: string };
type FileType = { ext: string, mime: string };
const RawFileSymbol = Symbol.for('@travetto/web-upload:raw-file');

/**
 * Web upload utilities
 */
export class WebUploadUtil {

  /**
   * Get uploaded file path location
   */
  static getUploadLocation(file: File): string {
    return castTo<{ [RawFileSymbol]: string }>(file)[RawFileSymbol];
  }

  /**
   * Get all the uploads, separating multipart from direct
   */
  static async* getUploads(req: HttpRequest, config: Partial<WebUploadConfig>): AsyncIterable<UploadItem> {
    if (MULTIPART.has(req.getContentType()?.full!)) {
      const fileMaxes = Object.values(config.uploads ?? {}).map(x => x.maxSize).filter(x => x !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
      const itr = new AsyncQueue<UploadItem>();

      // Upload
      req.inputStream.pipe(busboy({
        headers: {
          'content-type': req.headers.get('Content-Type')!,
          'content-disposition': req.headers.get('Content-Disposition')!,
          'content-length': req.headers.get('Content-Length')!,
          'content-range': req.headers.get('Content-Range')!,
          'content-encoding': req.headers.get('Content-Encoding')!,
          'content-transfer-encoding': req.headers.get('Content-Transfer-Encoding')!,
        },
        limits: { fileSize: largestMax }
      })
        .on('file', (field, stream, filename) => itr.add({ stream, filename, field }))
        .on('limit', field => itr.throw(new AppError(`File size exceeded for ${field}`, { category: 'data' })))
        .on('finish', () => itr.close())
        .on('error', (err) => itr.throw(err instanceof Error ? err : new Error(`${err}`))));

      yield* itr;
    } else {
      yield { stream: req.body ?? req.inputStream, filename: req.getFilename(), field: 'file' };
    }
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toFile({ stream, filename }: UploadItem, config: Partial<WebUploadConfig>): Promise<File> {
    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });

    filename = filename ? path.basename(filename) : `unknown_${Date.now()}`;

    const location = path.resolve(uniqueDir, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });
    const mimeCheck = config.matcher ??= MimeUtil.matcher(config.types);

    try {
      const target = createWriteStream(location);

      await (config.maxSize ?
        pipeline(stream, BinaryUtil.limitWrite(config.maxSize), target) :
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
}