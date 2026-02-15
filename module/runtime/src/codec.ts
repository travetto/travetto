import { createInterface } from 'node:readline/promises';

import { BinaryUtil, type BinaryArray, type BinaryType } from './binary.ts';

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
    return BinaryUtil.binaryArrayToBuffer(value).toString('hex');
  }

  /** Return buffer from base64 string  */
  static fromBase64String(value: string): BinaryArray {
    return Buffer.from(value, 'base64');
  }

  /** Convert value to base64 string  */
  static toBase64String(value: BinaryArray): string {
    return BinaryUtil.binaryArrayToBuffer(value).toString('base64');
  }

  /** Return buffer from utf8 string  */
  static fromUTF8String(value: string): BinaryArray {
    return Buffer.from(value ?? '', 'utf8');
  }

  /** Return utf8 string from bytes  */
  static toUTF8String(value: BinaryArray): string {
    return BinaryUtil.binaryArrayToBuffer(value).toString('utf8');
  }

  /** Convert utf8 value to base64 value string  */
  static utf8ToBase64(value: TextInput): string {
    return this.toBase64String(typeof value === 'string' ? Buffer.from(value, 'utf8') : value);
  }

  /** Convert base64 value to utf8 string  */
  static base64ToUTF8(value: TextInput): string {
    const result = this.toUTF8String(typeof value === 'string' ? Buffer.from(value, 'base64') : value);
    return result;
  }

  /** Convert url encoded base64 value to utf8 string  */
  static urlEncodedBase64ToUTF8(value: TextInput): string {
    const result = this.base64ToUTF8(value);
    return result.startsWith('%') ? decodeURIComponent(result) : result;
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
}