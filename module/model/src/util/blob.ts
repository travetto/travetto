import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import path from 'node:path';

import { getExtension, getType } from 'mime';

import { AppError, castTo, IOUtil, TypedObject, Util } from '@travetto/runtime';
import { ModelBlobMeta, ByteRange, ModelBlob } from '../types/blob';

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
   * Detect file type
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await IOUtil.readChunk(input, 4100);
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
   *
   * Note: For a given blob, due to the nature of hashing the content, this will load the entire blob into memory.
   * To that end, this method should only be called with small blobs or files
   */
  static async asBlob(src: Blob | Buffer | string, metadata: Partial<ModelBlobMeta> = {}): Promise<ModelBlob> {
    if (Buffer.isBuffer(src)) {
      src = new Blob([src]);
    }
    const contentType = metadata.contentType ?? (src instanceof Blob ? src.type : await this.resolveFileType(src));
    const filename = this.getFilename(src, { filename: metadata.filename, contentType });

    let input: () => Readable;
    if (src instanceof Blob) {
      const [a, b] = src.stream().tee();
      metadata.hash = await IOUtil.hashInput(Readable.fromWeb(b));
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
          await IOUtil.hashInput(input()) :
          undefined
        )
      }
    );
  }

  /**
   * Get a blob as an http response
   * @param blob
   * @returns
   */
  static blobToHttpResponse(blob: ModelBlob): {
    statusCode(): number;
    headers(): Record<string, string>;
    render(): Readable;
  } {
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

  /**
   * Get a hashed location/path for a blob
   *
   * @param blob
   * @param prefix
   * @returns
   */
  static getHashedLocation(blob: ModelBlob | ModelBlobMeta, prefix = ''): string {
    const meta = blob instanceof ModelBlob ? blob.meta : blob;
    let ext: string | undefined = '';

    if (meta.contentType) {
      ext = this.getExtension(meta.contentType);
    } else if (meta.filename) {
      const dot = meta.filename.indexOf('.');
      if (dot > 0) {
        ext = meta.filename.substring(dot + 1);
      }
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    const hash = meta.hash ?? Util.uuid();

    return hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
