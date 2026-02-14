import { TextDecoder } from 'node:util';

import { type BinaryType, BinaryUtil, type BinaryArray, castTo, Util, CodecUtil, hasToJSON, BinaryMetadataUtil, JSONUtil } from '@travetto/runtime';

import type { WebMessage } from '../types/message.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebError } from '../types/error.ts';

const WebRawBinarySymbol = Symbol();

const NULL_TERMINATOR = BinaryUtil.makeBinaryArray(0);

/**
 * Utility classes for supporting web body operations
 */
export class WebBodyUtil {

  /** Get Metadata Headers */
  static getMetadataHeaders(value: BinaryType): [string, string][] {
    const metadata = BinaryMetadataUtil.read(value);
    const length = BinaryMetadataUtil.readLength(metadata);

    const result = [
      ['Content-Type', metadata.contentType],
      ['Content-Length', length],
      ['Content-Encoding', metadata.contentEncoding],
      ['Cache-Control', metadata.cacheControl],
      ['Content-Language', metadata.contentLanguage],
      ...(metadata.range ? [['Accept-Ranges', 'bytes']] : []),
      ...(metadata.range ? [['Content-Range', `bytes ${metadata.range.start}-${metadata.range.end}/${metadata.size}`]] : []),
      ...(metadata.filename ? [['Content-Disposition', `attachment; filename="${metadata.filename}"`]] : [])
    ]
      .map((pair) => [pair[0], pair[1]?.toString()])
      .filter((pair): pair is [string, string] => pair[1] !== undefined);

    return result;
  }

  /**
   * Generate multipart body
   */
  static async * buildMultiPartBody(form: FormData, boundary: string): AsyncIterable<BinaryArray> {
    const bytes = (value: string = '', suffix = '\r\n'): BinaryArray => CodecUtil.fromUTF8String(`${value}${suffix}`);
    for (const [key, item] of form.entries()) {
      yield bytes(`--${boundary}`);
      const binaryValue = typeof item === 'string' ? CodecUtil.fromUTF8String(item) : item.slice();

      // Headers
      if (typeof item == 'string') {
        BinaryMetadataUtil.write(binaryValue, { size: item.length });
      }

      if (item instanceof File) {
        yield bytes(`Content-Disposition: form-data; name="${key}"; filename="${item.name || key}"`);
      }

      for (const [header, value] of WebBodyUtil.getMetadataHeaders(binaryValue)) {
        if (header.startsWith('Content-') && header !== 'Content-Disposition') {
          yield bytes(`${header}: ${value}`);
        }
      }

      yield bytes();
      if (binaryValue instanceof Blob) {
        yield* BinaryUtil.toBinaryStream(binaryValue);
      } else {
        yield binaryValue;
      }
      yield bytes();
    }
    yield bytes(`--${boundary}--`);
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
    const { body } = message;
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
      let text: BinaryArray;
      if (typeof body === 'string') {
        text = CodecUtil.fromUTF8String(body);
      } else if (hasToJSON(body)) {
        text = JSONUtil.toBinaryArray(body.toJSON());
      } else if (body instanceof Error) {
        text = JSONUtil.toBinaryArray({ message: body.message });
      } else {
        text = JSONUtil.toBinaryArray(body);
      }
      out.headers.set('Content-Length', `${text.byteLength}`);
      out.body = text;
    }

    out.headers.setIfAbsent('Content-Type', this.defaultContentType(body));

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
    return BinaryUtil.isBinaryType(body) && castTo<{ [WebRawBinarySymbol]: unknown }>(body)[WebRawBinarySymbol] === body;
  }

  /**
   * Simple parse support
   */
  static parseBody(type: string, body: string): unknown {
    switch (type) {
      case 'text': return body;
      case 'json': return JSONUtil.fromUTF8(body);
      case 'form': return Object.fromEntries(new URLSearchParams(body));
    }
  }

  /**
   * Read text from an input source
   */
  static async readText(input: BinaryType, limit: number, encoding?: string): Promise<{ text: string, read: number }> {
    encoding ??= CodecUtil.detectEncoding(input) ?? 'utf-8';

    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(encoding);
    } catch {
      throw WebError.for('Specified Encoding Not Supported', 415, { encoding });
    }

    if (BinaryUtil.isBinaryArray(input)) {
      if (input.byteLength > limit) {
        throw WebError.for('Request Entity Too Large', 413, { received: input.byteLength, limit });
      }
      return { text: decoder.decode(input), read: input.byteLength };
    }

    let received = 0;
    const all: string[] = [];

    try {
      for await (const chunk of BinaryUtil.toBinaryStream(input)) {
        const bytes = BinaryUtil.readChunk(chunk);
        received += bytes.byteLength;
        if (received > limit) {
          throw WebError.for('Request Entity Too Large', 413, { received, limit });
        }
        all.push(decoder.decode(bytes, { stream: true }));
      }
      all.push(decoder.decode(NULL_TERMINATOR, { stream: false }));
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