export type SerializedError = { $?: any, message: string, stack?: string, name: string };

/**
 * Mapping from error category to standard http error codes
 */
export const ERROR_CATEGORIES_WITH_CODES = [
  ['general', [500, 501]],
  ['notfound', [404, 416]],
  ['data', [400, 411, 414, 415, 431, 417, 428]],
  ['permissions', [403]],
  ['authentication', [401, 407, 511]],
  ['timeout', [408, 504]],
  ['unavailable', [503, 502, 429]]
] as const;

export type ErrorStatusCode = number;
export type ErrorCategory = (typeof ERROR_CATEGORIES_WITH_CODES)[number][0];

/**
 * Provides a mapping from error code to category and vice-versa
 */
const { fromCode, fromCategory } = ERROR_CATEGORIES_WITH_CODES.reduce(
  (acc, [typ, codes]) => {
    codes.forEach((c: ErrorStatusCode) => acc.fromCode.set(c, typ));
    acc.fromCategory.set(typ, codes[0]);
    return acc;
  },
  {
    fromCode: new Map<ErrorStatusCode, ErrorCategory>(),
    fromCategory: new Map<ErrorCategory, ErrorStatusCode>()
  }
);


/**
 * Common error utilities
 */
export class ErrorUtil {

  /**
   * Get category from status code
   */
  static categoryFromCode(...codes: (ErrorStatusCode | undefined)[]) {
    for (const el of codes) {
      if (el === undefined || !fromCode.has(el)) {
        continue;
      }
      return fromCode.get(el)!;
    }
    return 'general';
  }

  /**
 * Get category from status code
 */
  static codeFromCategory(...cateogires: (string | undefined)[]) {
    for (const el of cateogires) {
      if (el === undefined || !fromCategory.has(el as ErrorCategory)) {
        continue;
      }
      return fromCategory.get(el as ErrorCategory)!;
    }
    return 500;
  }


  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): SerializedError;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined) {
    let error: SerializedError | undefined;

    if (e) {
      error = {} as SerializedError;
      for (const k of Object.keys(e) as (keyof SerializedError)[]) {
        error[k] = (e as SerializedError)[k];
      }
      error.$ = true;
      error.message = e instanceof Error ? e.toJSON() : e.message;
      error.stack = e.stack;
      error.name = e.name;
    }

    return error;
  }

  /**
   * Reconstitute the error, post serialization
   */
  static deserializeError(e: Error | SerializedError): Error;
  static deserializeError(e: undefined): undefined;
  static deserializeError(e: Error | SerializedError | undefined) {
    if (e && '$' in e) {
      const err = new Error();
      for (const k of Object.keys(e) as (keyof Error)[]) {
        err[k] = e[k as keyof typeof e];
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