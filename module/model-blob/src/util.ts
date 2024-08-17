import fs from 'node:fs/promises';
import { Readable, PassThrough } from 'node:stream';
import { createReadStream } from 'node:fs';
import path from 'node:path';

import { getExtension, getType } from 'mime';

import { AppError, castTo, TypedObject } from '@travetto/runtime';
import { ExistsError, NotFoundError } from '@travetto/model';

import { ModelBlobMeta, ByteRange, ModelBlob } from './types';
import { ModelBlobSupport } from './service';
import { BlobDataUtil } from './data';

const FIELD_TO_HEADER: Record<keyof ModelBlobMeta, string> = {
  contentType: 'content-type',
  contentEncoding: 'content-encoding',
  cacheControl: 'cache-control',
  contentLanguage: 'content-language',
  size: 'content-length',
  hash: '',
  filename: '',
  title: ''
};

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: ByteRange, size: number): Required<ByteRange> {
    end = Math.min(end ?? size - 1, size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', 'data');
    }

    return { start, end };
  }

  /**
   * Ensure unique
   */
  static async ensureUnique(storage: ModelBlobSupport, location: string, overwriteIfFound = false): Promise<void> {
    if (!overwriteIfFound) {
      let missing = false;
      try {
        await storage.describeBlob(location);
      } catch (err) {
        if (err instanceof NotFoundError) {
          missing = true;
        } else {
          throw err;
        }
      }
      if (!missing) {
        throw new ExistsError('Asset', location);
      }
    }
  }

  /**
   * Detect file type
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await BlobDataUtil.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);
    if (matched?.ext === 'wav') {
      return { ext: '.wav', mime: 'audio/wav' };
    }
    if (typeof input === 'string' && matched?.mime === 'video/mp4' && input.endsWith('.m4a')) {
      return { ext: '.m4a', mime: 'audio/mp4' };
    }
    if (matched?.ext === castTo('mpga')) {
      return { ext: '.mp3', mime: 'audio/mpeg' };
    }
    return matched;
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string): Promise<string> {
    const type = await this.resolveFileType(filePath);
    const ext = this.getExtension(type);
    const baseName = path.basename(filePath, path.extname(filePath));
    const newFile = `${baseName}.${ext}`;

    if (filePath !== newFile) {
      await fs.rename(filePath, newFile);
      filePath = newFile;
    }

    return filePath;
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
   * Read content type from location on disk
   */
  static async resolveFileType(pth: string): Promise<string> {
    const detected = await this.detectFileType(pth);
    let contentType: string | undefined | null = undefined;

    if (!detected || detected.mime === 'application/octet-stream') {
      contentType = getType(pth);
    } else {
      contentType = detected.mime;
    }
    return contentType ?? 'application/octet-stream';
  }

  /**
   * Get filename for a given input
   */
  static getFilename(src: Blob | string, meta: Pick<ModelBlobMeta, 'filename' | 'contentType'>): string {
    let filename = meta.filename;

    // Detect name if missing
    if (!filename) {
      if (typeof src === 'string') {
        filename = path.basename(src);
      } else if (src instanceof File) {
        filename = src.name;
      }
    }

    filename ??= `unknown_${Date.now()}`;

    // Add extension if missing
    if (filename) {
      const extName = path.extname(filename);
      if (!extName) {
        const ext = this.getExtension(meta.contentType);
        if (ext) {
          filename = `${filename}.${ext}`;
        }
      }
    }

    return filename;
  }

  /**
   * Convert blob to asset structure
   */
  static async asBlob(src: Blob | string, metadata: Partial<ModelBlobMeta> = {}): Promise<ModelBlob> {
    const contentType = metadata.contentType ?? (src instanceof Blob ? src.type : await this.resolveFileType(src));
    const filename = this.getFilename(src, { filename: metadata.filename, contentType });

    let input: () => Readable;
    if (src instanceof Blob) {
      const [a, b] = src.stream().tee();
      metadata.hash = await BlobDataUtil.computeHash(Readable.fromWeb(b));
      input = (): Readable => Readable.from(a);
    } else {
      input = (): Readable => createReadStream(src);
    }

    return new ModelBlob(
      input,
      {
        ...metadata,
        size: metadata.size ?? (src instanceof Blob ? src.size : (await fs.stat(src)).size),
        filename,
        contentType,
        hash: metadata.hash ?? (typeof src === 'string' ?
          await BlobDataUtil.computeHash(input()) :
          undefined
        )
      }
    );

  }

  static getLazyStream(src: () => (Promise<Readable> | Readable)): () => Readable {
    const out = new PassThrough();
    const run = (): void => { Promise.resolve(src()).then(v => v.pipe(out), (err) => out.destroy(err)); };
    return () => (run(), out);
  }

  static blobToHttp(blob: ModelBlob): unknown {
    return {
      statusCode(): number {
        return blob.range ? 206 : 200;
      },

      headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        for (const [f, v] of TypedObject.entries(FIELD_TO_HEADER)) {
          if (blob.meta[f] && v) {
            headers[v] = `${blob.meta[f]}`;
          }
        }
        if (blob.meta.filename) {
          headers['content-disposition'] = `attachment;filename=${path.basename(blob.meta.filename)}`;
        }
        if (blob.range) {
          headers['accept-ranges'] = 'bytes';
          headers['content-range'] = `bytes ${blob.range.start}-${blob.range.end}/${blob.meta.size}`;
          headers['content-length'] = `${blob.range.end - blob.range.start + 1}`;
        }
        return headers;
      },

      render(): Readable {
        return Readable.from(blob.stream());
      }
    };
  }
}
