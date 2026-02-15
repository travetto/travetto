import type { BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';
import { AppError } from './error.ts';

type JSONTransformer = (this: unknown, key: string, value: unknown) => unknown;
type JSONOutputConfig = {
  indent?: number;
  replacer?: JSONTransformer;
  replace?: {
    all?: boolean;
    Date?: boolean;
    BigInt?: boolean;
    AppError?: boolean;
    Error?: boolean;
    MissingValue?: unknown;
    includeStack?: boolean;
    bigintSuffix?: string;
  };
};
type JSONInputConfig = {
  reviver?: JSONTransformer;
  revive?: {
    all?: boolean;
    Date?: boolean;
    BigInt?: boolean;
    AppError?: boolean;
    Error?: boolean;
    MissingValue?: unknown;
    bigintSuffix?: string;
  };
};
type JSONCloneConfig = (JSONInputConfig & JSONOutputConfig);

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const IS_ERROR = (value: unknown): value is Error => typeof value === 'object' && value !== null && '$error' in value && value.$error === 'plain';

/** Utilities for JSON  */
export class JSONUtil {

  static #revivers = new Map<string, JSONTransformer>();
  static #replacers = new Map<string, JSONTransformer>();

  static buildReviver = (config?: JSONInputConfig): JSONTransformer => {

    const all = config?.revive?.all ?? true;
    const resolved = {
      Date: config?.revive?.Date ?? all,
      BigInt: config?.revive?.BigInt ?? all,
      AppError: config?.revive?.AppError ?? all,
      Error: config?.revive?.Error ?? all,
      MissingValue: (!!config?.revive && 'MissingValue' in config.revive),
      bigintSuffix: config?.revive?.bigintSuffix ?? 'n'
    };

    const cacheKey = config ? Object.values(resolved).map(v => `${v}`).join('|') : 'DEFAULT';

    if (!this.#revivers.has(cacheKey)) {
      const BIGINT_REGEX = new RegExp(`^-?\\d+${resolved.bigintSuffix}$`);

      const reviver = function (this: unknown, key: string, value: unknown): unknown {
        if (resolved.Date && typeof value === 'string' && ISO_8601_REGEX.test(value)) {
          value = new Date(value);
        } else if (resolved.BigInt && typeof value === 'string' && BIGINT_REGEX.test(value)) {
          value = BigInt(value.slice(0, -resolved.bigintSuffix.length));
        } else if (resolved.AppError && AppError.isJSON(value)) {
          value = AppError.fromJSON(value);
        } else if (resolved.Error && IS_ERROR(value)) {
          const error = new Error(value.message);
          error.name = value.name;
          error.stack = value.stack ?? error.stack;
          value = error;
        }
        value = config?.reviver ? config.reviver.call(this, key, value) : value;
        if (resolved.MissingValue && (value === null || value === undefined)) {
          value = config!.revive?.MissingValue;
        }
        return value;
      };
      this.#revivers.set(cacheKey, reviver);
    }
    return this.#revivers.get(cacheKey)!;
  };

  static buildReplacer = (config?: JSONOutputConfig): JSONTransformer => {
    const all = config?.replace?.all ?? true;
    const resolved = {
      Date: config?.replace?.Date ?? all,
      BigInt: config?.replace?.BigInt ?? all,
      AppError: config?.replace?.AppError ?? all,
      Error: config?.replace?.Error ?? all,
      MissingValue: (config?.replace && 'MissingValue' in config.replace),
      bigintSuffix: config?.replace?.bigintSuffix ?? 'n',
    };

    const cacheKey = config ? Object.values(resolved).map(v => `${v}`).join('|') : 'DEFAULT';

    if (!this.#replacers.has(cacheKey)) {
      const replacer = function (this: unknown, key: string, value: unknown): unknown {
        if (resolved.Date && value instanceof Date) {
          return value.toISOString();
        } else if (resolved.BigInt && typeof value === 'bigint') {
          return `${value}${resolved.bigintSuffix}`;
        } else if (resolved.AppError && value instanceof AppError) {
          return { ...value.toJSON(config?.replace?.includeStack), $error: 'trv', };
        } else if (resolved.Error && value instanceof Error) {
          return {
            message: value.message,
            name: value.name,
            ...(config?.replace?.includeStack !== false ? { stack: value.stack } : {}),
            $error: 'plain',
          };
        }
        value = config?.replacer ? config.replacer.call(this, key, value) : value;
        if (resolved.MissingValue && (value === null || value === undefined)) {
          value = config!.replace!.MissingValue;
        }
        return value;
      };
      this.#replacers.set(cacheKey, replacer);
    }
    return this.#replacers.get(cacheKey)!;
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

  /** JSON to UTF8 pretty string */
  static toUTF8Pretty(value: unknown): string {
    return this.toUTF8(value, { indent: 2 });
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
  static toBase64<T>(value: T): string {
    return CodecUtil.utf8ToBase64(JSONUtil.toUTF8(value));
  }

  /** Decode JSON value from base64 encoded string */
  static fromBase64<T>(input: string): T {
    let decoded = CodecUtil.base64ToUTF8(input);

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return JSONUtil.fromUTF8(decoded);
  }

  /** JSON to JSON, with optional transformations, useful for deep cloning or applying transformations to a value */
  static clone<T, R = T>(input: T, config?: JSONCloneConfig): R {
    const json = JSONUtil.toUTF8(input, config);
    return JSONUtil.fromUTF8<R>(json, config);
  }

  static cloneForTransmit<T, R = T>(input: T): R {
    return JSONUtil.clone<T, R>(input, { revive: { all: false }, replace: { includeStack: true } });
  }
}