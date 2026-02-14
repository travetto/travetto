import type { BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';
import { AppError } from './error.ts';

type TextInput = string | BinaryArray;
type JSONTransformer = (this: unknown, key: string, value: unknown) => unknown;
type JSONOutputConfig = { replacer?: JSONTransformer, indent?: number };
type JSONInputConfig = {
  reviver?: JSONTransformer;
  reviveDates?: boolean;
  reviveBigInts?: boolean;
  reviveErrors?: boolean;
};
type JSONInputOutputConfig = (JSONInputConfig & JSONOutputConfig);

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const BIGINT_REGEX = /^-?\d+n$/;
Object.defineProperty(BigInt.prototype, 'toJSON', {
  value() { return `${this.toString()}n`; }
});

/** Utilities for JSON operations */
export class JSONUtil {

  static buildReviver = (config?: JSONInputConfig) =>
    function (this: unknown, key: string, value: unknown): unknown {
      if (config?.reviveDates !== false && typeof value === 'string' && ISO_8601_REGEX.test(value)) {
        return new Date(value);
      } else if (config?.reviveBigInts !== false && typeof value === 'string' && BIGINT_REGEX.test(value)) {
        return BigInt(value.slice(0, -1));
      } else if (config?.reviveErrors !== false && AppError.isJSON(value)) {
        return AppError.fromJSON(value) ?? value;
      }
      return config?.reviver ? config.reviver.call(this, key, value) : value;
    };


  /** Parse JSON safely */
  static fromJSON<T>(input: TextInput, config?: JSONInputConfig): T {
    if (typeof input !== 'string') {
      input = CodecUtil.toUTF8String(input);
    }

    if (!input.trim()) {
      return undefined!;
    }

    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, JSONUtil.buildReviver(config));
  }

  /** JSON to UTF8 */
  static toUTF8JSON(value: unknown, config?: JSONOutputConfig): string {
    return JSON.stringify(value, config?.replacer, config?.indent);
  }

  /** JSON to bytes */
  static toBinaryArrayJSON(value: unknown, config?: JSONOutputConfig): BinaryArray {
    return CodecUtil.fromUTF8String(this.toUTF8JSON(value, config));
  }

  /** Encode JSON value as base64 encoded string */
  static toBase64JSON<T>(value: T, config?: JSONOutputConfig): string {
    return CodecUtil.utf8ToBase64(this.toUTF8JSON(value, config));
  }

  /** JSON to JSON, with optional transformations, useful for deep cloning or applying transformations to a value */
  static toJSONObject<T, R>(input: T, config?: JSONInputOutputConfig): R {
    const json = JSONUtil.toBinaryArrayJSON(input, config);
    return JSONUtil.fromJSON<R>(json, config);
  }

  /** Decode JSON value from base64 encoded string */
  static fromBase64JSON<T>(input: TextInput): T {
    let decoded = CodecUtil.base64ToUTF8(input);

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return JSONUtil.fromJSON(decoded);
  }
}