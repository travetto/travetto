import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import busboy from '@fastify/busboy';
import { getExtension, getType } from 'mime';

import { Request, MimeUtil } from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { AsyncQueue, AppError, castTo, Util, BinaryInput, BinaryUtil } from '@travetto/runtime';

import { RestUploadConfig } from './config';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: Readable, filename: string, field: string };

/**
 * Rest upload utilities
 */
export class RestUploadUtil {

  /**
   * Get all the uploads, separating multipart from direct
   */
  static async* getUploads(req: Request, config: Partial<RestUploadConfig>): AsyncIterable<UploadItem> {
    if (MULTIPART.has(req.getContentType()?.type!)) {
      const fileMaxes = [...Object.values(config.uploads ?? {}).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;

      const itr = new AsyncQueue<UploadItem>();
      const uploader = busboy({ headers: castTo(req.headers), limits: { fileSize: largestMax } })
        .on('file', (field, stream, filename) => itr.add({ stream, filename, field }))
        .on('limit', field => itr.throw(new AppError(`File size exceeded for ${field}`, 'data')));

      // Do upload
      pipeline(req.stream(), uploader).then(() => itr.close());
      yield* itr;
    } else {
      yield { stream: req.body ?? req[NodeEntityⲐ], filename: req.getFilename(), field: 'file' };
    }
  }

  /**
   * Treat a readable stream as an upload
   */
  static async upload({ stream, filename }: UploadItem, config: Partial<RestUploadConfig>): Promise<Blob> {
    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    filename = path.basename(filename);

    const location = path.resolve(uniqueDir, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });

    try {
      await this.streamWithLimit(stream, createWriteStream(location), config.maxSize);
      const contentType = (await this.detectType(location)).mime;

      if (!path.extname(filename)) {
        filename = `${filename}.${this.getExtension(contentType)}`;
      }

      const blob = BinaryUtil.readableBlob(() => createReadStream(location), {
        contentType,
        filename,
        hash: await BinaryUtil.hashInput(createReadStream(location)),
        size: (await fs.stat(location)).size,
      });

      if (config.cleanupFiles !== false) {
        castTo<{ cleanup: Function }>(blob).cleanup = remove;
      }

      const check = config.matcher ??= MimeUtil.matcher(config.types);
      if (!check(blob.type)) {
        throw new AppError(`Content type not allowed: ${blob.type}`, 'data');
      }
      return blob;
    } catch (err) {
      await remove();
      throw err;
    }
  }

  /**
   * Read a chunk from a file
   */
  static async readChunk(input: BinaryInput | string, bytes: number): Promise<Buffer> {
    if (input instanceof Blob) {
      return input.slice(0, bytes).arrayBuffer().then(v => Buffer.from(v));
    } else if (Buffer.isBuffer(input)) {
      return input.subarray(0, bytes);
    } else if (typeof input === 'string') {
      input = createReadStream(input);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of input) {
      const bChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(bChunk);
      if ((size += bChunk.length) >= bytes) {
        break;
      }
    }
    return Buffer.concat(chunks).subarray(0, bytes);
  }

  /**
   * Stream from input to output, enforcing a max size
   */
  static async streamWithLimit(input: Readable, output: Writable, maxSize?: number): Promise<void> {
    let read = 0;

    if (maxSize) {
      await pipeline(
        input,
        new Transform({
          transform(chunk, encoding, callback): void {
            read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : 0;
            if (read > maxSize) {
              callback(new AppError('File size exceeded', 'data', {
                read,
                maxSize
              }));
            } else {
              callback(null, chunk);
            }
          },
        }),
        output
      );
    } else {
      await pipeline(input, output);
    }
  }

  /**
   * Get extension for a given content type
   * @param contentType
   */
  static getExtension(contentType: string): string | undefined {
    const res = getExtension(contentType)!;
    if (res === 'mpga') {
      return 'mp3';
    }
    return res;
  }

  /**
   * Detect file type
   */
  static async detectType(input: BinaryInput | string, filename?: string): Promise<{ ext: string, mime: string }> {
    if (typeof input === 'string') {
      filename = input;
    }
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);

    if (!matched && (filename || input instanceof File)) {
      const mime = getType(filename || castTo<File>(input).name);
      if (mime) {
        const ext = this.getExtension(mime)!;
        if (ext) {
          return { ext, mime };
        }
      }
    }

    filename ??= (input instanceof File ? input.name : undefined);

    switch (matched?.ext.toString()) {
      case 'mpga': return { ext: 'mp3', mime: 'audio/mpeg' };
      case 'wav': return { ext: 'wav', mime: 'audio/wav' };
      case 'mp4': {
        if (filename?.endsWith('.m4a')) {
          return { ext: 'm4a', mime: 'audio/mp4' };
        }
        break;
      }
    }

    return matched ?? { ext: 'bin', mime: 'application/octet-stream' };
  }
}