import type { BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';
import { AppError, type AppErrorOptions } from './error.ts';
import { castTo } from './types.ts';

type JSONTransformer = (this: unknown, key: string, value: unknown) => unknown;
type JSONOutputConfig = { indent?: number, replacer?: JSONTransformer };
type JSONInputConfig = { reviver?: JSONTransformer };
type JSONCloneConfig = JSONOutputConfig & JSONInputConfig;
type ErrorShape<T extends string, V> = { $trv: T, message: string, stack?: string } & V;
type JSONError =
  ErrorShape<'AppError', AppErrorOptions<Record<string, unknown>>> |
  ErrorShape<'plain', { name: string }>;

Object.defineProperty(BigInt.prototype, 'toJSON', {
  value() { return `${this}n`; },
});

Object.defineProperty(Error.prototype, 'toJSON', {
  value() { return JSONUtil.errorToJSONError(this); },
});

Object.defineProperty(AppError.prototype, 'toJSON', {
  value() { return JSONUtil.errorToJSONError(this); },
});

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const BIGINT_REGEX = /^-?\d+n$/;

/** Utilities for JSON  */
export class JSONUtil {

  static includeStackTraces = false;

  static TRANSMIT_REVIVER: JSONTransformer = function (this: unknown, key: string, value: unknown): unknown {
    if (typeof value === 'string') {
      if (value.endsWith('n') && BIGINT_REGEX.test(value)) {
        return BigInt(value.slice(0, -1));
      } else if (ISO_8601_REGEX.test(value)) {
        return new Date(value);
      }
    } else if (JSONUtil.isJSONError(value)) {
      return JSONUtil.jsonErrorToError(value);
    }
    return value;
  };


  static isJSONError(value: unknown): value is JSONError {
    return typeof value === 'object' && value !== null && '$trv' in value && (
      value.$trv === AppError.name || value.$trv === 'plain'
    );
  }

  /** Convert from JSON object */
  static jsonErrorToError(error: JSONError): Error | AppError {
    switch (error.$trv) {
      case 'AppError': {
        const { $trv: _, ...rest } = error;
        const result = new AppError(error.message, castTo<AppErrorOptions<Record<string, unknown>>>(rest));
        result.stack = error.stack;
        return result;
      }
      case 'plain': {
        const result = new Error(error.message);
        result.name = error.name;
        result.stack = error.stack ?? result.stack;
        return result;
      }
    }
  }

  /**
   * Serializes an error to a basic object
   */
  static errorToJSONError(error: AppError | Error, includeStack?: boolean): JSONError | undefined {
    includeStack ??= JSONUtil.includeStackTraces;
    if (error instanceof AppError) {
      return {
        $trv: 'AppError',
        message: error.message,
        name: undefined!,
        category: error.category,
        ...(error.cause ? { cause: `${error.cause}` } : undefined),
        type: error.type,
        at: error.at,
        ...(error.details ? { details: error.details } : undefined!),
        ...(includeStack ? { stack: error.stack } : undefined)
      };
    } else {
      return {
        $trv: 'plain',
        message: error.message,
        name: error.name,
        ...(includeStack ? { stack: error.stack } : undefined)
      };
    }
  }

  /** UTF8 string to JSON */
  static fromUTF8<T>(input: string, config?: JSONInputConfig): T {
    if (!input.trim()) {
      return undefined!;
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, config?.reviver);
  }

  /** JSON to UTF8 string */
  static toUTF8(value: unknown, config?: JSONOutputConfig): string {
    return JSON.stringify(value, config?.replacer, config?.indent);
  }

  /** JSON to UTF8 pretty string */
  static toUTF8Pretty(value: unknown): string {
    return JSONUtil.toUTF8(value, { indent: 2 });
  }

  /** Binary Array to JSON */
  static fromBinaryArray<T>(input: BinaryArray): T {
    return JSONUtil.fromUTF8(CodecUtil.toUTF8String(input));
  }

  /** JSON to Binary Array */
  static toBinaryArray(value: unknown, config?: JSONOutputConfig): BinaryArray {
    return CodecUtil.fromUTF8String(JSONUtil.toUTF8(value, config));
  }

  /** Encode JSON value as base64 encoded string */
  static toBase64<T>(value: T): string {
    return CodecUtil.utf8ToBase64(JSONUtil.toUTF8(value));
  }

  /** Decode JSON value from base64 encoded string */
  static fromBase64<T>(input: string): T {
    return JSONUtil.fromUTF8(CodecUtil.urlEncodedBase64ToUTF8(input));
  }

  /** JSON to JSON, with optional transformations, useful for deep cloning or applying transformations to a value */
  static clone<T, R = T>(input: T, config?: JSONCloneConfig): R {
    return JSONUtil.fromUTF8(JSONUtil.toUTF8(input, config), config);
  }

  static cloneForTransmit<T, R = T>(input: T): R {
    try {
      this.includeStackTraces = true;
      return JSONUtil.clone<T, R>(input);
    } finally {
      this.includeStackTraces = false;
    }
  }

  static cloneFromTransmit<T, R = T>(input: T): R {
    return JSONUtil.clone<T, R>(input, { reviver: JSONUtil.TRANSMIT_REVIVER });
  }
}