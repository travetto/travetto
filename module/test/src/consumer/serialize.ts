import { AppError, hasToJSON } from '@travetto/runtime';

import { TestEvent, } from '../model/event';


export type SerializedError = { [K in keyof Error]: Error[K] extends Function ? never : Error[K] } & { $: true };

function isError(e: unknown): e is SerializedError {
  return !!e && (typeof e === 'object') && '$' in e;
}

export class SerializeUtil {

  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): SerializedError;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined): SerializedError | undefined {
    if (!e) {
      return;
    }

    return {
      $: true,
      ...hasToJSON(e) ? e.toJSON() : e,
      name: e.name,
      message: e.message,
      stack: e.stack?.replace(/.*\[ERR_ASSERTION\]:\s*/, ''),
    };
  }

  /**
   * Reconstitute the error, post serialization
   */
  static deserializeError(e: Error | SerializedError): Error;
  static deserializeError(e: undefined): undefined;
  static deserializeError(e: Error | SerializedError | undefined): Error | undefined {
    if (isError(e)) {
      const err = AppError.fromJSON(e) ?? new Error();
      if (!(err instanceof AppError)) {
        const { $: _, ...rest } = e;
        Object.assign(err, rest);
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else {
      return e;
    }
  }

  /**
   * Serialize to JSON
   */
  static serializeToJSON(out: TestEvent): string {
    return JSON.stringify(out, (_, v) =>
      v instanceof Error ? this.serializeError(v) :
        typeof v === 'bigint' ? v.toString() : v
    );
  }
}