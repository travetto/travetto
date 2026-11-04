import { createInterface } from 'node:readline/promises';
import { Readable } from 'node:stream';

import { CustomAsyncIterable } from './async-iterable.ts';
import { type BinaryArray, type BinaryType, BinaryUtil } from './binary.ts';
import { RuntimeError } from './error.ts';
import { type Any, castTo } from './types.ts';

type TextInput = string | BinaryArray;
type LinesInput = BinaryType | string | string[] | Promise<string | string[] | BinaryType>;
type LinesOptions = { signal?: AbortSignal };

const UTF8_DECODER = new TextDecoder('utf8');
const UTF8_ENCODER = new TextEncoder();
const DOUBLE_QUOTE = '"'.charCodeAt(0);
const isStringArray = (input: unknown): input is string[] => Array.isArray(input) && typeof input[0] === 'string';

/**
 * Utilities for encoding and decoding common formats
 */
export class CodecUtil {
  /** Generate buffer from hex string  */
  static fromHexString(value: string): BinaryArray {
    try {
      return Uint8Array.fromHex(value);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new RuntimeError('Invalid hex string', { cause: err });
      }
      throw err;
    }
  }

  /** Convert hex bytes to string  */
  static toHexString(value: BinaryArray): string {
    return BinaryUtil.binaryArrayToUint8Array(value).toHex();
  }

  /** Return buffer from base64 string  */
  static fromBase64String(value: string): BinaryArray {
    try {
      return Uint8Array.fromBase64(value);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new RuntimeError('Invalid base64 string', { cause: err });
      }
      throw err;
    }
  }

  /** Convert value to base64 string  */
  static toBase64String(value: BinaryArray): string {
    return BinaryUtil.binaryArrayToUint8Array(value).toBase64();
  }

  /** Return buffer from utf8 string  */
  static fromUTF8String(value: string): BinaryArray {
    return UTF8_ENCODER.encode(value);
  }

  /** Return utf8 string from bytes  */
  static toUTF8String(value: BinaryArray): string {
    return UTF8_DECODER.decode(BinaryUtil.binaryArrayToUint8Array(value));
  }

  /** Convert utf8 value to base64 value string  */
  static utf8ToBase64(value: TextInput): string {
    return this.toBase64String(typeof value === 'string' ? this.fromUTF8String(value) : value);
  }

  /** Convert base64 value to utf8 string  */
  static base64ToUTF8(value: TextInput): string {
    const result = this.toUTF8String(typeof value === 'string' ? this.fromBase64String(value) : value);
    return result;
  }

  /** Convert url encoded base64 value to utf8 string  */
  static urlEncodedBase64ToUTF8(value: TextInput): string {
    const result = this.base64ToUTF8(value);
    return result.startsWith('%') ? decodeURIComponent(result) : result;
  }

  /** Detect encoding of a binary type, if possible  */
  static detectEncoding(input: BinaryType): string | undefined {
    if (input && typeof input === 'object' && 'readableEncoding' in input && typeof input.readableEncoding === 'string') {
      return input.readableEncoding;
    }
  }

  /** Read chunk as utf8 if not a binary array */
  static readUtf8Chunk(chunk: Any): BinaryArray {
    return BinaryUtil.isBinaryArray(chunk) ? chunk : this.fromUTF8String(typeof chunk === 'string' ? chunk : `${chunk}`);
  }

  /** Read chunk, default to toString if type is unknown  */
  static readChunk(chunk: Any, encoding?: string | null): BinaryArray {
    if (!encoding) {
      return this.readUtf8Chunk(chunk);
    }
    return BinaryUtil.isBinaryArray(chunk)
      ? chunk
      : Buffer.from(typeof chunk === 'string' ? chunk : `${chunk}`, castTo(encoding ?? 'utf8'));
  }

  /** Read the first line of a string */
  static readFirstLine(data: string | undefined, defaultValue = ''): string {
    const end = data?.indexOf('\n');
    return data?.substring(0, end && end < 0 ? undefined : end)?.trim() ?? defaultValue;
  }

  /** Parse a single delimited line respecting RFC 4180 quotes */
  static parseLine(line: string, delimiter = ','): string[] {
    const values: string[] = [];
    const current: number[] = [];
    let inQuotes = false;
    const delimiterCode = delimiter.charCodeAt(0);

    for (let i = 0; i < line.length; i += 1) {
      const charCode = line.charCodeAt(i);
      if (charCode === DOUBLE_QUOTE) {
        if (inQuotes && line.charCodeAt(i + 1) === DOUBLE_QUOTE) {
          i += 1; // Skip next quote
        } else {
          inQuotes = !inQuotes;
          continue;
        }
      }

      if (charCode === delimiterCode && !inQuotes) {
        values.push(String.fromCharCode(...current).trim());
        current.splice(0, current.length);
      } else {
        current.push(charCode);
      }
    }
    values.push(String.fromCharCode(...current).trim());
    return values;
  }

  /** Simple CSV parser */
  static csvParser<T>(options?: { separator?: string; fieldNames?: string[] }): (line: string) => T | undefined {
    let fieldNames: string[] = options?.fieldNames ?? [];
    let separator = options?.separator ?? '';
    return line => {
      if (!line.trim()) {
        return;
      }
      separator ||= line.split('\t').length > line.split(',').length ? '\t' : ',';
      const items = CodecUtil.parseLine(line, separator);
      if (fieldNames.length === 0) {
        fieldNames = items;
      } else {
        return Object.fromEntries(fieldNames.map((key, i) => [key, items[i]])) as T;
      }
    };
  }

  /**
   * Stream lines from a binary stream, string, or string array as a {@link CustomAsyncIterable}.
   */
  static streamLines(stream: LinesInput, options?: LinesOptions): CustomAsyncIterable<string> {
    return new CustomAsyncIterable<string>(async function* () {
      const source = await stream;
      const input = typeof source === 'string' || isStringArray(source) ? Readable.from(source) : BinaryUtil.toReadable(source);
      yield* createInterface({ input, signal: options?.signal });
    });
  }
}
