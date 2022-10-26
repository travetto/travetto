export type SerializedError = { $?: boolean, message: string, stack?: string, name: string };

function isSerialized(e: unknown): e is SerializedError {
  return !!e && (typeof e === 'object') && '$' in e;
}

/**
 * Common error utilities
 */
export class ErrorUtil {

  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): SerializedError;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined): SerializedError | undefined {
    let error: SerializedError | undefined;

    if (e) {
      error = { $: true, name: e.name, message: '' };
      for (const k of Object.keys<{ name: string }>(e)) {
        error[k] = e[k];
      }
      error.name = e.name;
      if (e instanceof Error) {
        Object.assign(error, e.toJSON());
      }
      error.message ??= e.message;
      error.stack ??= e.stack;
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

      for (const k of Object.keys<{ name: string }>(e)) {
        err[k] = e[k];
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else if (e) {
      return e;
    }
  }
}