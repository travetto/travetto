import { type BinaryArray, type BinaryType, BinaryUtil } from './binary.ts';
import { RuntimeError } from './error.ts';
import { type Any, castTo } from './types.ts';

type TextInput = string | BinaryArray;

const UTF8_DECODER = new TextDecoder('utf8');
const UTF8_ENCODER = new TextEncoder();
const DOUBLE_QUOTE = '"'.charCodeAt(0);

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
  static parseCSVLine(line: string, delimiter = ','): string[] {
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
  static csvParser<T>(options?: { separator?: string; fieldNames?: string[] }): (line: string) => T[] {
    let fieldNames: string[] = options?.fieldNames ?? [];
    let separator = options?.separator ?? '';
    return line => {
      if (line.trim()) {
        separator ||= line.split('\t').length > line.split(',').length ? '\t' : ',';
        const items = CodecUtil.parseCSVLine(line, separator);
        if (fieldNames.length === 0) {
          fieldNames = items;
        } else {
          return [Object.fromEntries(fieldNames.map((key, i) => [key, items[i]])) as T];
        }
      }
      return [];
    };
  }

  /**
   * Parse lines as a $flatMap compatible friend
   */
  static lineParser(options?: { trim?: 'all' | 'start' | 'end'; skipEmpty?: boolean }): (input: BinaryArray | string) => Promise<string[]> {
    const CARRIAGE_RETURN = '\r'.charCodeAt(0);
    const NEWLINE = '\n'.charCodeAt(0);
    const trim = options?.trim ?? false;
    const skipEmpty = options?.skipEmpty ?? false;

    function flush(...buffer: Buffer[]): string[] {
      let result = buffer.length === 1 ? buffer[0] : Buffer.concat(buffer);

      if (result[result.length - 1] === CARRIAGE_RETURN) {
        result = result.subarray(0, result.length - 1);
      }

      if (!result.length) {
        return [];
      }

      let output = result.toString('utf8');
      if (trim === 'end') {
        output = output.trimEnd();
      } else if (trim === 'start') {
        output = output.trimStart();
      } else if (trim === 'all') {
        output = output.trim();
      }
      if (skipEmpty && !output.trim()) {
        return [];
      }
      return [output];
    }

    let buffer: Buffer[] = [];
    return async function (input: BinaryArray | string): Promise<string[]> {
      const array = await (typeof input === 'string' ? Buffer.from(input, 'utf8') : BinaryUtil.toBuffer(input));

      // We are done
      if (array.length === 0) {
        return flush(...buffer);
      }

      const output: string[] = [];

      let position = 0;
      let eolIdx = array.indexOf(NEWLINE, position);
      while (eolIdx >= 0) {
        output.push(...flush(...buffer, array.subarray(position, eolIdx)));
        buffer = [];
        position = eolIdx + 1;
        eolIdx = array.indexOf(NEWLINE, position);
      }

      if (position < array.length) {
        buffer.push(Buffer.from(array.subarray(position)));
      }

      return output;
    };
  }
}
