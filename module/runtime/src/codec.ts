import { createInterface } from 'node:readline/promises';

import { BinaryUtil, type BinaryArray, type BinaryType } from './binary.ts';
import { hasToJSON, type Any } from './types.ts';
import { AppError } from './error.ts';

type TextInput = string | BinaryArray;

type Transformer = (this: unknown, key: string, value: unknown, target?: unknown) => unknown;

type JSONOutputConfig = {
  replacer?: Transformer;
  defaultReplacer?: boolean;
  indent?: number;
};

type JSONInputConfig = {
  reviver?: Transformer;
  defaultReviver?: boolean;
};

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const BIGINT_REGEX = /^-?\d+n$/;

function isFauxError(value: unknown): value is Error & { $error: true } {
  return typeof value === 'object' && !!value && '$error' in value;
}

const DEFAULT_REPLACER = function (this: Any, key: string | symbol, value: unknown): unknown {
  const rawValue = this[key];
  if (typeof rawValue === 'bigint') {
    return `${rawValue.toString()}n`;
  } else if (rawValue instanceof Error) {
    return {
      $error: true,
      ...hasToJSON(rawValue) ? rawValue.toJSON() : rawValue,
      name: rawValue.name,
      message: rawValue.message,
      stack: rawValue.stack,
    };
  } else {
    return value;
  }
};

const DEFAULT_REVIVER = function (this: Any, _key: string | symbol, value: unknown): unknown {
  if (typeof value === 'string') {
    if (ISO_8601_REGEX.test(value)) {
      return new Date(value);
    } else if (BIGINT_REGEX.test(value)) {
      return BigInt(value.slice(0, -1));
    }
  } else if (isFauxError(value)) {
    const error = AppError.fromJSON(value) ?? new Error();
    if (!(error instanceof AppError)) {
      const { $error: _, ...rest } = value;
      Object.assign(error, rest);
    }
    error.message = value.message;
    error.stack = value.stack;
    error.name = value.name;
    return error;
  }
  return value;
};

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
  static fromJSON<T>(input: TextInput, config?: JSONInputConfig): T {
    if (typeof input !== 'string') {
      input = CodecUtil.toUTF8String(input);
    }
    if (!input) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return undefined as T;
    }

    let reviver: Transformer | undefined = config?.reviver;
    if (config?.defaultReviver !== false) {
      if (reviver) {
        const original = reviver;
        reviver = (key: string, subValue: unknown): unknown =>
          DEFAULT_REVIVER(key, original(key, subValue));
      } else {
        reviver = DEFAULT_REVIVER;
      }
    }

    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, reviver);
  }

  /**
   * JSON to UTF8
   */
  static toUTF8JSON(value: unknown, config?: JSONOutputConfig): string {
    let replacer: Transformer | undefined = config?.replacer;
    if (config?.defaultReplacer !== false) {
      if (replacer) {
        const original = replacer;
        replacer = (key: string, subValue: unknown): unknown =>
          DEFAULT_REPLACER(key, original(key, subValue));
      } else {
        replacer = DEFAULT_REPLACER;
      }
    }

    return JSON.stringify(value, replacer, config?.indent);
  }

  /**
   * JSON to bytes
   */
  static toJSON(value: unknown, config?: JSONOutputConfig): BinaryArray {
    return this.fromUTF8String(this.toUTF8JSON(value, config));
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static toBase64JSON<T>(value: T, config?: JSONOutputConfig): string {
    return CodecUtil.utf8ToBase64(this.toUTF8JSON(value, config));
  }

  /**
   * JSON to JSON, with optional transformations, useful for deep cloning or applying transformations to a value
   */
  static jsonTOJSON<T, R>(input: T, config: JSONInputConfig & JSONOutputConfig): R {
    const json = this.toJSON(input, config);
    return this.fromJSON<R>(json, config);
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