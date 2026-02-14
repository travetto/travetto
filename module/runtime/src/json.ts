import type { BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';
import { AppError } from './error.ts';

type TextInput = string | BinaryArray;
type JSONTransformer = (this: unknown, key: string, value: unknown) => unknown;
type JSONOutputConfig = {
  indent?: number;
  replacer?: JSONTransformer;
  replaceStandard?: boolean;
  replaceDates?: boolean;
  replaceBigInts?: boolean;
  replaceErrors?: boolean;
  replaceMissingValue?: unknown;
};
type JSONInputConfig = {
  reviver?: JSONTransformer;
  reviveStandard?: boolean;
  reviveDates?: boolean;
  reviveBigInts?: boolean;
  reviveErrors?: boolean;
  reviveMissingValue?: unknown;
};
type JSONCloneConfig = (JSONInputConfig & JSONOutputConfig);

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const BIGINT_REGEX = /^-?\d+n$/;

/** Utilities for JSON  */
export class JSONUtil {

  static buildReviver = (config?: JSONInputConfig) => {
    const reviveDates = config?.reviveDates === true || config?.reviveStandard !== false;
    const reviveBigInts = config?.reviveBigInts === true || config?.reviveStandard !== false;
    const reviveErrors = config?.reviveErrors === true || config?.reviveStandard !== false;
    const reviveMissingValue = config && 'reviveMissingValue' in config;

    return function (this: unknown, key: string, value: unknown): unknown {
      const isString = typeof value === 'string';
      if (reviveDates && isString && ISO_8601_REGEX.test(value)) {
        return new Date(value);
      } else if (reviveBigInts && isString && BIGINT_REGEX.test(value)) {
        return BigInt(value.slice(0, -1));
      } else if (reviveErrors && AppError.isJSON(value)) {
        return AppError.fromJSON(value) ?? value;
      } else if (reviveMissingValue && (value === null || value === undefined)) {
        return config!.reviveMissingValue;
      }
      return config?.reviver ? config.reviver.call(this, key, value) : value;
    };
  };

  static buildReplacer = (config?: JSONOutputConfig): JSONTransformer | undefined => {
    const replaceDates = config?.replaceDates === true || config?.replaceStandard !== false;
    const replaceBigInts = config?.replaceBigInts === true || config?.replaceStandard !== false;
    const replaceErrors = config?.replaceErrors === true || config?.replaceStandard !== false;
    const replaceMissingValue = config && 'replaceMissingValue' in config;

    return function (this: unknown, key: string, value: unknown): unknown {
      if (replaceDates && value instanceof Date) {
        return value.toISOString();
      } else if (replaceBigInts && typeof value === 'bigint') {
        return `${value}n`;
      } else if (replaceErrors && value instanceof AppError) {
        return value.toJSON();
      } else if (replaceMissingValue && (value === null || value === undefined)) {
        return config!.replaceMissingValue;
      }
      return config?.replacer ? config.replacer.call(this, key, value) : value;
    };
  };


  /** UTF8 string to JSON */
  static fromUTF8<T>(input: string, config?: JSONInputConfig): T {
    if (!input.trim()) {
      return undefined!;
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, JSONUtil.buildReviver(config));
  }

  /** JSON to UTF8 string */
  static toUTF8(value: unknown, config?: JSONOutputConfig): string {
    return JSON.stringify(value, JSONUtil.buildReplacer(config), config?.indent);
  }

  /** Binary Array to JSON */
  static fromBinaryArray<T>(input: BinaryArray, config?: JSONInputConfig): T {
    return JSONUtil.fromUTF8(CodecUtil.toUTF8String(input), config);
  }

  /** JSON to Binary Array */
  static toBinaryArray(value: unknown, config?: JSONOutputConfig): BinaryArray {
    return CodecUtil.fromUTF8String(JSONUtil.toUTF8(value, config));
  }

  /** Encode JSON value as base64 encoded string */
  static toBase64<T>(value: T, config?: JSONOutputConfig): string {
    return CodecUtil.utf8ToBase64(JSONUtil.toUTF8(value, config));
  }

  /** Decode JSON value from base64 encoded string */
  static fromBase64<T>(input: TextInput): T {
    let decoded = CodecUtil.base64ToUTF8(input);

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return JSONUtil.fromUTF8(decoded);
  }

  /** JSON to JSON, with optional transformations, useful for deep cloning or applying transformations to a value */
  static clone<T, R>(input: T, config?: JSONCloneConfig): R {
    const json = JSONUtil.toUTF8(input, config);
    return JSONUtil.fromUTF8<R>(json, config);
  }

  /** Clone for transmit */
  static cloneForTransmit<T>(input: unknown, config?: JSONCloneConfig): T {
    return JSONUtil.clone(input, { reviveStandard: false, ...config });
  }
}