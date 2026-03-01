import { createInterface } from 'node:readline/promises';

import { BinaryUtil, type BinaryArray, type BinaryType } from './binary.ts';
import { RuntimeError } from './error.ts';
import { castTo, type Any } from './types.ts';

type TextInput = string | BinaryArray;

const UTF8_DECODER = new TextDecoder('utf8');
const UTF8_ENCODER = new TextEncoder();

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

  /** Consume lines  */
  static async readLines(stream: BinaryType, handler: (input: string) => unknown | Promise<unknown>): Promise<void> {
    for await (const item of createInterface(BinaryUtil.toReadable(stream))) {
      await handler(item);
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
    return BinaryUtil.isBinaryArray(chunk) ? chunk :
      Buffer.from(typeof chunk === 'string' ? chunk : `${chunk}`, castTo(encoding ?? 'utf8'));
  }
}