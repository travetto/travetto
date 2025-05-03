import iconv from 'iconv-lite';

import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Any, BinaryUtil, castTo, hasToJSON, Util } from '@travetto/runtime';

import { WebBinaryBody, WebMessage } from '../types/message.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebError } from '../types/error.ts';

const WebRawStreamSymbol = Symbol();

/**
 * Utility classes for supporting web body operations
 */
export class WebBodyUtil {

  /**
   * Convert a node binary input to a buffer
   */
  static async toBuffer(src: WebBinaryBody): Promise<Buffer> {
    return Buffer.isBuffer(src) ? src : toBuffer(src);
  }

  /**
   * Convert a node binary input to a readable
   */
  static toReadable(src: WebBinaryBody): Readable {
    return Buffer.isBuffer(src) ? Readable.from(src) : src;
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
  static toBinaryMessage(message: WebMessage): Omit<WebMessage<WebBinaryBody>, 'context'> {
    const body = message.body;
    if (Buffer.isBuffer(body) || BinaryUtil.isReadable(body)) {
      return castTo(message);
    }

    const out: Omit<WebMessage<WebBinaryBody>, 'context'> = { headers: new WebHeaders(message.headers), body: null! };
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
  static markRaw(val: WebBinaryBody | undefined): typeof val {
    if (val) {
      Object.defineProperty(val, WebRawStreamSymbol, { value: val });
    }
    return val;
  }

  /**
   * Is the input raw
   */
  static isRaw(val: unknown): val is WebBinaryBody {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return !!val && ((Buffer.isBuffer(val) || BinaryUtil.isReadable(val)) && (val as Any)[WebRawStreamSymbol] === val);
  }

  /**
   * Simple parse support
   */
  static parseBody(type: string, val: string): unknown {
    switch (type) {
      case 'text': return val;
      case 'json': return JSON.parse(val);
      case 'form': return Object.fromEntries(new URLSearchParams(val));
    }
  }

  /**
   * Read text from an input source
   */
  static async readText(input: Readable | Buffer, limit: number, encoding?: string): Promise<{ text: string, read: number }> {
    encoding ??= (Buffer.isBuffer(input) ? undefined : input.readableEncoding) ?? 'utf-8';

    if (!iconv.encodingExists(encoding)) {
      throw WebError.for('Specified Encoding Not Supported', 415, { encoding });
    }

    if (Buffer.isBuffer(input)) {
      return { text: iconv.decode(input, encoding), read: input.byteLength };
    }

    let received = Buffer.isBuffer(input) ? input.byteOffset : 0;
    const decoder = iconv.getDecoder(encoding);
    const all: string[] = [];

    try {
      for await (const chunk of input.iterator({ destroyOnReturn: false })) {
        received += Buffer.isBuffer(chunk) ? chunk.byteLength : (typeof chunk === 'string' ? chunk.length : chunk.length);
        if (received > limit) {
          throw WebError.for('Request Entity Too Large', 413, { received, limit });
        }
        all.push(decoder.write(chunk));
      }
      all.push(decoder.end() ?? '');
      return { text: all.join(''), read: received };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw WebError.for('Request Aborted', 400, { received });
      } else {
        throw err;
      }
    }
  }
}