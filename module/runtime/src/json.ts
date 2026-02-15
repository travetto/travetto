import type { BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';

type JSONTransformer = (this: unknown, key: string, value: unknown) => unknown;
type JSONOutputConfig = {
  indent?: number;
  replacer?: JSONTransformer;
};
type JSONInputConfig = {
  reviver?: JSONTransformer;
};
type JSONCloneConfig = JSONOutputConfig & JSONInputConfig;

Object.defineProperty(BigInt.prototype, 'toJSON', {
  value() { return `${this}n`; },
  configurable: true,
});

Object.defineProperty(Error.prototype, 'toJSON', {
  value(this: Error) {
    return {
      $trv: 'Error',
      message: this.message,
      name: this.name,
      stack: this.stack,
    };
  },
  configurable: true,
});

/** Utilities for JSON  */
export class JSONUtil {

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

  static cloneForTransmit<T, R = T>(input: T, config?: JSONCloneConfig): R {
    return JSONUtil.clone<T, R>(input, config);
  }

  static cloneFromTransmit<T, R = T>(input: T, config?: JSONCloneConfig): R {
    return JSONUtil.clone<T, R>(input, config);
  }
}