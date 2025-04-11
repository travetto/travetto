import { Readable } from 'node:stream';
import { isArrayBuffer } from 'node:util/types';

import { BinaryUtil, hasFunction, hasToJSON, Util } from '@travetto/runtime';
import { WebHeaders, WebResponse } from '@travetto/web';

const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  !!v && (typeof v === 'object' || typeof v === 'function') && Symbol.asyncIterator in v;

type WebBodyShape = {
  body: Readable | Buffer;
  headers?: WebHeaders;
  statusCode?: number;
};

const DEFAULT_TYPE = 'application/octet-stream';

export class WebBodyUtil {

  /**
   * Build WebResponse based on return value
   */
  static defaultContentType<T>(value: T): string {
    if (value === undefined || value === null) {
      return '';
    } else if (typeof value === 'string') {
      return 'text/plain';
    } else if (Buffer.isBuffer(value) || isArrayBuffer(value) || BinaryUtil.isReadable(value) || isReadableStream(value)) {
      return DEFAULT_TYPE;
    } else if (value instanceof Blob) {
      return value.type || DEFAULT_TYPE;
    } else if (isAsyncIterable(value)) {
      return DEFAULT_TYPE;
    } else if (value instanceof FormData) {
      return 'multipart/form-data';
    } else {
      return 'application/json';
    }
  }

  /** Serialize file/blob */
  static fromBlob<T extends Blob>(value: T): WebBodyShape {
    const meta = BinaryUtil.getBlobMeta(value);
    const headers = new WebHeaders();

    headers.set('Content-Length', `${value.size}`);

    if (meta?.range) {
      headers.set('accept-ranges', 'bytes');
      headers.set('Content-range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`);
    }

    meta?.contentEncoding && headers.set('Content-Encoding', meta.contentEncoding);
    meta?.cacheControl && headers.set('Cache-Control', meta.cacheControl);
    meta?.contentLanguage && headers.set('Content-Language', meta.contentLanguage);

    if (value instanceof File && value.name) {
      headers.set('Content-disposition', `attachment; filename="${value.name}"`);
    }

    return { body: Readable.fromWeb(value.stream()), headers };
  }

  /** Get response from form data */
  static fromFormData<T extends FormData>(form: T): WebBodyShape {
    const boundary = `-------------------------multipart-${Util.uuid()}`;
    const nl = '\r\n';

    const source = (async function* (): AsyncIterable<Buffer | string> {
      for (const [k, v] of form.entries()) {
        const data = v.slice();
        const filename = data instanceof File ? data.name : undefined;
        const size = data instanceof Blob ? data.size : data.length;
        const type = data instanceof Blob ? data.type : undefined;
        yield `--${boundary}${nl}`;
        yield `Content-Disposition: form-data; name="${k}"; filename="${filename ?? k}"${nl}`;
        yield `Content-Length: ${size}${nl}`;
        if (type) {
          yield `Content-Type: ${type}${nl}`;
        }
        yield nl;
        if (data instanceof Blob) {
          for await (const chunk of data.stream()) {
            yield chunk;
          }
        } else {
          yield data;
        }
        yield nl;
      }
      yield `--${boundary}--${nl}`;
    });

    const headers = new WebHeaders();
    headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);

    return { body: Readable.from(source()), headers };
  }

  static toOutputStream(res: WebResponse): WebBodyShape {
    const value = res.body;
    if (value === undefined || value === null) {
      return { body: Buffer.alloc(0) };
    } else if (typeof value === 'string') {
      return { body: Buffer.from(value, 'utf8') };
    } else if (Buffer.isBuffer(value) || isArrayBuffer(value)) {
      return { body: Buffer.isBuffer(value) ? value : Buffer.from(value) };
    } else if (BinaryUtil.isReadable(value) || isReadableStream(value)) {
      return { body: isReadableStream(value) ? Readable.fromWeb(value) : value };
    } else if (value instanceof Error) {
      const text = JSON.stringify(hasToJSON(value) ? value.toJSON() : { message: value.message });
      return { body: Buffer.from(text, 'utf-8') };
    } else if (value instanceof Blob) {
      return this.fromBlob(value);
    } else if (isAsyncIterable(value)) {
      return { body: Readable.from(value) };
    } else if (value instanceof FormData) {
      return this.fromFormData(value);
    } else {
      const text = JSON.stringify(hasToJSON(value) ? value.toJSON() : value);
      return { body: Buffer.from(text, 'utf-8') };
    }
  }
}