import crypto, { type BinaryToTextEncoding } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

import { BinaryUtil, type BinaryArray, type BinaryStream, type BinaryType } from './binary.ts';
import type { Any } from './types.ts';

type HashConfig = {
  length?: number;
  hashAlgorithm?: 'sha1' | 'sha256' | 'sha512' | 'md5';
  outputEncoding?: BinaryToTextEncoding;
};

/**
 * Utilities for encoding and decoding common formats
 */
export class CodecUtil {

  /** Generate buffer from hex string  */
  static fromHexString(value: string): Buffer<ArrayBuffer> {
    return Buffer.from(value, 'hex');
  }

  /** Convert hex bytes to string  */
  static toHexString(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('hex');
  }

  /** Return buffer from base64 string  */
  static fromBase64String(value: string): Buffer<ArrayBuffer> {
    return Buffer.from(value, 'base64');
  }

  /** Convert value to base64 string  */
  static toBase64String(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('base64');
  }

  /** Return buffer from utf8 string  */
  static fromUTF8String(value: string): Buffer<ArrayBuffer> {
    return Buffer.from(value ?? '', 'utf8');
  }

  /** Return utf8 string from bytes  */
  static toUTF8String(value: BinaryArray): string {
    return BinaryUtil.arrayToBuffer(value).toString('utf8');
  }

  /** Convert utf8 value to base64 value string  */
  static utf8ToBase64(value: string | Buffer<ArrayBuffer>): string {
    return (Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')).toString('base64');
  }

  /** Convert base64 value to utf8 string  */
  static base64ToUTF8(value: string | Buffer<ArrayBuffer>): string {
    return (Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64')).toString('utf8');
  }

  /** Generate a hash from an input value  * @param input The seed value to build the hash from
   * @param length The optional length of the hash to generate
   * @param hashAlgorithm The hash algorithm to use
   * @param outputEncoding The output encoding format
   */
  static hash(input: string | BinaryArray, config?: HashConfig): string;
  static hash(input: BinaryStream | Blob, config?: HashConfig): Promise<string>;
  static hash(input: string | BinaryType, config?: HashConfig): string | Promise<string> {
    const hashAlgorithm = config?.hashAlgorithm ?? 'sha512';
    const outputEncoding = config?.outputEncoding ?? 'hex';
    const length = config?.length;
    const hash = crypto.createHash(hashAlgorithm).setEncoding(outputEncoding);

    if (BinaryUtil.isBinaryStream(input) || input instanceof Blob) {
      return BinaryUtil.pipeline(input, hash).then(() =>
        hash.digest(outputEncoding).substring(0, length)
      );
    } else {
      if (typeof input !== 'string') {
        input = BinaryUtil.arrayToBuffer(input).toString('utf8');
      }
      hash.update(input);
      return hash.digest(outputEncoding).substring(0, length);
    }
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
  static fromJSON<T>(input: BinaryArray | string, reviver?: (this: unknown, key: string, value: Any) => unknown): T {
    if (typeof input !== 'string') {
      input = this.toUTF8String(input);
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, reviver);
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static toBase64JSON<T>(value: T | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    return this.utf8ToBase64(JSON.stringify(value));
  }

  /**
   * Decode JSON value from base64 encoded string
   */
  static fromBase64JSON<T>(input: string): T;
  static fromBase64JSON<T>(input?: undefined): undefined;
  static fromBase64JSON<T>(input?: string | undefined): T | undefined {
    if (!input) {
      return undefined;
    }

    let decoded = CodecUtil.base64ToUTF8(input);

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return this.fromJSON(decoded);
  }
}