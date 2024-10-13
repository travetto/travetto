import { hasFunction, TypedObject } from '@travetto/runtime';

import { TestEvent, } from '../model/event';


export type SerializedError = { $?: boolean, message: string, stack?: string, name: string };

function isError(e: unknown): e is SerializedError {
  return !!e && (typeof e === 'object') && '$' in e;
}

const hasToJSON = hasFunction<{ toJSON(): object }>('toJSON');

export class SerializeUtil {

  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): Error;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined): Error | undefined {
    let error: SerializedError | undefined;

    if (e) {
      error = { $: true, name: e.name, message: '' };
      for (const k of TypedObject.keys<{ name: string }>(e)) {
        error[k] = e[k];
      }
      error.name = e.name;
      if (hasToJSON(e)) {
        Object.assign(error, e.toJSON());
      }
      error.message ||= e.message;
      error.stack ??= e.stack?.replace(/.*\[ERR_ASSERTION\]:\s*/, '');
    }

    return error;
  }

  /**
   * Reconstitute the error, post serialization
   */
  static deserializeError(e: Error | SerializedError): Error;
  static deserializeError(e: undefined): undefined;
  static deserializeError(e: Error | SerializedError | undefined): Error | undefined {
    if (isError(e)) {
      const err = new Error();

      for (const k of TypedObject.keys(e)) {
        if (k === '$') {
          continue;
        }
        err[k] = e[k]!;
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