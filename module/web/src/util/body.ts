import { TextDecoder } from 'node:util';

import { type Any, type BinaryType, BinaryUtil, type ByteArray, castTo, hasToJSON, JSONUtil, Util } from '@travetto/runtime';

import type { WebMessage } from '../types/message.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebError } from '../types/error.ts';

const WebRawBinarySymbol = Symbol();

/**
 * Utility classes for supporting web body operations
 */
export class WebBodyUtil {

  /**
   * Generate multipart body
   */
  static async * buildMultiPartBody(form: FormData, boundary: string): AsyncIterable<ByteArray> {
    const newLine = '\r\n';
    const bytes = (value: string): ByteArray => BinaryUtil.fromUTF8String(value);
    for (const [key, value] of form.entries()) {
      const data = value.slice();
      const filename = data instanceof File ? data.name : undefined;
      const size = data instanceof Blob ? data.size : data.length;
      const type = data instanceof Blob ? data.type : undefined;
      yield bytes(`--${boundary}${newLine}`);
      yield bytes(`Content-Disposition: form-data; name="${key}"; filename="${filename ?? key}"${newLine}`);
      yield bytes(`Content-Length: ${size}${newLine}`);
      if (type) {
        yield bytes(`Content-Type: ${type}${newLine}`);
      }
      yield bytes(newLine);
      if (data instanceof Blob) {
        for await (const chunk of data.stream()) {
          yield chunk;
        }
      } else {
        yield bytes(data);
      }
      yield bytes(newLine);
    }
    yield bytes(`--${boundary}--${newLine}`);
  }

  /** Get Metadata Headers */
  static getMetadataHeaders(value: BinaryType): [string, string][] {
    const meta = BinaryUtil.getMetadata(value);

    const toAdd: [string, string | undefined][] = [
      ['Content-Type', meta.contentType],
      ['Content-Length', (value instanceof Blob ? value.size : meta.size)?.toString()],
      ['Content-Encoding', meta.contentEncoding],
      ['Cache-Control', meta.cacheControl],
      ['Content-Language', meta.contentLanguage],
    ];

    if (meta?.range) {
      toAdd.push(
        ['Accept-Ranges', 'bytes'],
        ['Content-Range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`],
      );
    }

    const filename = (value instanceof File ? value.name : undefined) ?? meta.filename;
    if (filename) {
      toAdd.push(['Content-disposition', `attachment; filename="${filename}"`]);
    }

    return toAdd.filter((pair): pair is [string, string] => !!pair[1]);
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
  static toBinaryMessage(message: WebMessage): Omit<WebMessage<BinaryType>, 'context'> {
    const body = message.body;
    const out: Omit<WebMessage<BinaryType>, 'context'> = { headers: new WebHeaders(message.headers), body: null! };

    if (BinaryUtil.isBinaryType(body)) {
      for (const [key, value] of this.getMetadataHeaders(body)) {
        out.headers.set(key, value);
      }
      out.body = body;
    } else if (body instanceof FormData) {
      const boundary = `${'-'.repeat(24)}-multipart-${Util.uuid()}`;
      out.headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
      out.body = this.buildMultiPartBody(body, boundary);
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
      out.body = BinaryUtil.fromUTF8String(text);
    }

    if (BinaryUtil.isByteArray(out.body)) {
      out.headers.set('Content-Length', `${out.body.byteLength}`);
    }

    out.headers.setIfAbsent('Content-Type', this.defaultContentType(message.body));

    return castTo(out);
  }

  /**
   * Set body and mark as unprocessed
   */
  static markRawBinary(body: BinaryType | undefined): typeof body {
    if (body) {
      Object.defineProperty(body, WebRawBinarySymbol, { value: body });
    }
    return body;
  }

  /**
   * Is the input raw
   */
  static isRawBinary(body: unknown): body is BinaryType {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return !!body && (BinaryUtil.isBinaryType(body) && (body as Any)[WebRawBinarySymbol] === body);
  }

  /**
   * Simple parse support
   */
  static parseBody(type: string, body: string): unknown {
    switch (type) {
      case 'text': return body;
      case 'json': return JSONUtil.parseSafe(body);
      case 'form': return Object.fromEntries(new URLSearchParams(body));
    }
  }

  /**
   * Read text from an input source
   */
  static async readText(input: BinaryType, limit: number, encoding?: string): Promise<{ text: string, read: number }> {
    encoding ??= BinaryUtil.detectEncoding(input) ?? 'utf-8';

    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(encoding);
    } catch {
      throw WebError.for('Specified Encoding Not Supported', 415, { encoding });
    }

    if (BinaryUtil.isByteArray(input)) {
      if (input.byteLength > limit) {
        throw WebError.for('Request Entity Too Large', 413, { received: input.byteLength, limit });
      }
      return { text: decoder.decode(input), read: input.byteLength };
    }

    let received = 0;
    const all: string[] = [];

    try {
      for await (const chunk of BinaryUtil.toByteStream(input)) {
        const buffer = BinaryUtil.readChunksAsBuffer(chunk);
        received += buffer.byteLength;
        if (received > limit) {
          throw WebError.for('Request Entity Too Large', 413, { received, limit });
        }
        all.push(decoder.decode(buffer, { stream: true }));
      }
      all.push(decoder.decode(Buffer.alloc(0), { stream: false }));
      return { text: all.join(''), read: received };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw WebError.for('Request Aborted', 400, { received });
      } else {
        throw error;
      }
    }
  }
}