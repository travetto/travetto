import { AppError, hasToJSON, JSONUtil } from '@travetto/runtime';

/**
 * Tools for communication serialization/deserialization especially with errors
 */
export class CommunicationUtil {

  /**
   * Serialize to JSON
   */
  static serialize<T>(out: T): string {
    return JSON.stringify(out, function (key, value) {
      const objectValue = this[key];
      if (objectValue && objectValue instanceof Error) {
        return {
          $: true,
          ...hasToJSON(objectValue) ? objectValue.toJSON() : objectValue,
          name: objectValue.name,
          message: objectValue.message,
          stack: objectValue.stack,
        };
      } else if (typeof value === 'bigint') {
        return `${value.toString()}$n`;
      } else {
        return value;
      }
    });
  }

  /**
   * Serialize to a standard object, instead of a string
   */
  static serializeToObject<R = Record<string, unknown>, T = unknown>(out: T): R {
    return JSONUtil.parseSafe(this.serialize(out));
  }

  /**
   * Deserialize from JSON
   */
  static deserialize<T = unknown>(input: string): T {
    return JSONUtil.parseSafe(input, function (key, value) {
      if (value && typeof value === 'object' && '$' in value) {
        const error = AppError.fromJSON(value) ?? new Error();
        if (!(error instanceof AppError)) {
          const { $: _, ...rest } = value;
          Object.assign(error, rest);
        }
        error.message = value.message;
        error.stack = value.stack;
        error.name = value.name;
        return error;
      } else if (typeof value === 'string' && /^\d+[$]n$/.test(value)) {
        return BigInt(value.split('$')[0]);
      } else {
        return value;
      }
    });
  }

  /**
   * Deserialize from a standard object, instead of a string
   */
  static deserializeFromObject<R = unknown, T = R>(input: T): R {
    return this.deserialize<R>(JSON.stringify(input));
  }
}