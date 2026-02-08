import { createInterface } from 'node:readline/promises';

import { BinaryUtil, type BinaryArray, type BinaryType } from './binary.ts';
import type { Any } from './types.ts';

type TextInput = string | BinaryArray;

/**
 * Utilities for encoding and decoding common formats
 */
export class CodecUtil {

  /** Generate buffer from hex string  */
  static fromHexString(value: string): BinaryArray {
    return Buffer.from(value, 'hex');
  }

  /** Convert hex bytes to string  */
  static toHexString(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('hex');
  }

  /** Return buffer from base64 string  */
  static fromBase64String(value: string): BinaryArray {
    return Buffer.from(value, 'base64');
  }

  /** Convert value to base64 string  */
  static toBase64String(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('base64');
  }

  /** Return buffer from utf8 string  */
  static fromUTF8String(value: string): BinaryArray {
    return Buffer.from(value ?? '', 'utf8');
  }

  /** Return utf8 string from bytes  */
  static toUTF8String(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('utf8');
  }

  /** Convert utf8 value to base64 value string  */
  static utf8ToBase64(value: TextInput): string {
    return this.toBase64String(typeof value === 'string' ? Buffer.from(value, 'utf8') : value);
  }

  /** Convert base64 value to utf8 string  */
  static base64ToUTF8(value: TextInput): string {
    return this.toUTF8String(typeof value === 'string' ? Buffer.from(value, 'base64') : value);
  }

  /** Detect encoding of a binary type, if possible  */
  static detectEncoding(input: BinaryType): BufferEncoding | undefined {
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

  /**
   * Parse JSON safely
   */
  static fromJSON<T>(input: TextInput, reviver?: (this: unknown, key: string, value: Any) => unknown): T {
    if (typeof input !== 'string') {
      input = CodecUtil.toUTF8String(input);
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, reviver);
  }

  /**
   * JSON to bytes
   */
  static toJSON(value: Any, replacer?: (this: unknown, key: string, value: Any) => unknown): BinaryArray {
    return CodecUtil.fromUTF8String(JSON.stringify(value, replacer));
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static toBase64JSON<T>(value: T): string {
    return CodecUtil.utf8ToBase64(JSON.stringify(value));
  }

  /**
   * Decode JSON value from base64 encoded string
   */
  static fromBase64JSON<T>(input: TextInput): T {
    let decoded = CodecUtil.base64ToUTF8(input);

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return CodecUtil.fromJSON(decoded);
  }
}