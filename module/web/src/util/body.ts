import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Any, BinaryUtil, castTo, ErrorCategory, hasToJSON, Util } from '@travetto/runtime';

import { WebMessage } from '../types/message.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebInternalSymbol } from '../types/core.ts';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };

export type NodeBinary = Readable | Buffer;

/**
 * Mapping from error category to standard http error codes
 */
const ERROR_CATEGORY_STATUS: Record<ErrorCategory, number> = {
  general: 500,
  notfound: 404,
  data: 400,
  permissions: 403,
  authentication: 401,
  timeout: 408,
  unavailable: 503,
};

/**
 * Utility classes for supporting web body operations
 */
export class WebBodyUtil {

  /**
   * Convert a node binary input to a buffer
   */
  static async toBuffer(src: NodeBinary): Promise<Buffer> {
    return Buffer.isBuffer(src) ? src : toBuffer(src);
  }

  /**
   * Convert a node binary input to a readable
   */
  static toReadable(src: NodeBinary): Readable {
    return Buffer.isBuffer(src) ? Readable.from(src) : src;
  }

  /**
   * Get the error status code given its category
   */
  static getErrorStatus(e: Error): number {
    const error: ErrorResponse = e;
    return error.status ?? error.statusCode ?? ERROR_CATEGORY_STATUS[error.category!] ?? 500;
  }

  /**
   * Generate multipart body
   */
  static async * buildMultiPartBody(form: FormData, boundary: string): AsyncIterable<string | Buffer> {
    const nl = '\r\n';
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
  }

  /** Get Blob Headers */
  static getBlobHeaders(value: Blob): [string, string][] {
    const meta = BinaryUtil.getBlobMeta(value);

    const toAdd: [string, string | undefined][] = [
      ['Content-Type', value.type],
      ['Content-Length', `${value.size}`],
      ['Content-Encoding', meta?.contentEncoding],
      ['Cache-Control', meta?.cacheControl],
      ['Content-Language', meta?.contentLanguage],
    ];

    if (meta?.range) {
      toAdd.push(
        ['Accept-Ranges', 'bytes'],
        ['Content-Range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`],
      );
    }

    if (value instanceof File && value.name) {
      toAdd.push(['Content-disposition', `attachment; filename="${value.name}"`]);
    }

    return toAdd.filter((x): x is [string, string] => !!x[1]);
  }

  /**
   * Build WebResponse based on return value
   */
  static defaultContentType(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    } else if (typeof value === 'string') {
      return 'text/plain';
    } else if (BinaryUtil.isBinaryType(value)) {
      return 'application/octet-stream';
    } else if (value instanceof FormData) {
      return 'multipart/form-data';
    } else {
      return 'application/json';
    }
  }

  /**
   * Convert an existing web message to a binary web message
   */
  static toBinaryMessage(message: WebMessage): WebMessage<NodeBinary> & { body: NodeBinary } {
    const body = message.body;
    if (Buffer.isBuffer(body) || BinaryUtil.isReadable(body)) {
      return castTo(message);
    }

    const out: WebMessage<NodeBinary> = { headers: new WebHeaders(message.headers), body: null! };
    if (body instanceof Blob) {
      for (const [k, v] of this.getBlobHeaders(body)) {
        out.headers.set(k, v);
      }
      out.body = Readable.fromWeb(body.stream());
    } else if (body instanceof FormData) {
      const boundary = `${'-'.repeat(24)}-multipart-${Util.uuid()}`;
      out.headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
      out.body = Readable.from(this.buildMultiPartBody(body, boundary));
    } else if (BinaryUtil.isReadableStream(body)) {
      out.body = Readable.fromWeb(body);
    } else if (BinaryUtil.isAsyncIterable(body)) {
      out.body = Readable.from(body);
    } else if (body === null || body === undefined) {
      out.body = Buffer.alloc(0);
    } else if (BinaryUtil.isArrayBuffer(body)) {
      out.body = Buffer.from(body);
    } else {
      let text: string;
      if (typeof body === 'string') {
        text = body;
      } else if (hasToJSON(body)) {
        text = JSON.stringify(body.toJSON());
      } else if (body instanceof Error) {
        text = JSON.stringify({ message: body.message });
      } else {
        text = JSON.stringify(body);
      }
      out.body = Buffer.from(text, 'utf-8');
    }

    if (Buffer.isBuffer(out.body)) {
      out.headers.set('Content-Length', `${out.body.byteLength}`);
    }

    out.headers.setIfAbsent('Content-Type', this.defaultContentType(message.body));

    return castTo(out);
  }

  /**
   * Set body and mark as unprocessed
   */
  static markRaw(val: Readable | Buffer | undefined): typeof val {
    if (val) {
      Object.defineProperty(val, WebInternalSymbol, { value: val });
    }
    return val;
  }

  /**
   * Get unprocessed value as readable stream
   */
  static getRawStream(val: unknown): Readable | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if ((Buffer.isBuffer(val) || BinaryUtil.isReadable(val)) && (val as Any)[WebInternalSymbol] === val) {
      return WebBodyUtil.toReadable(val);
    }
  }
}