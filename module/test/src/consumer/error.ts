import { TypedObject } from '@travetto/base';

import { TestEvent, } from '../model/event';


export type SerializedError = { $?: boolean, message: string, stack?: string, name: string };

function isSerialized(e: unknown): e is SerializedError {
  return !!e && (typeof e === 'object') && '$' in e;
}

export class ErrorUtil {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static hasToJSON = (o: unknown): o is { toJSON: () => any } => typeof o === 'object' && !!o && 'toJSON' in o && typeof o.toJSON === 'function';

  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): SerializedError;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined): SerializedError | undefined {
    let error: SerializedError | undefined;

    if (e) {
      error = { $: true, name: e.name, message: '' };
      for (const k of TypedObject.keys<{ name: string }>(e)) {
        error[k] = e[k];
      }
      error.name = e.name;
      if (this.hasToJSON(e)) {
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
    if (isSerialized(e)) {
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
    } else if (e) {
      return e;
    }
  }

  /**
   * Serialize all errors for a given test for transmission between parent/child
   */
  static serializeTestErrors(out: TestEvent): void {
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          out.test.error = this.serializeError(out.test.error) as Error;
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          out.assertion.error = this.serializeError(out.assertion.error) as Error;
        }
      }
    }
  }
}