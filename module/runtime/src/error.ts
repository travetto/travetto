import { castTo } from './types.ts';

export type ErrorCategory =
  'general' |
  'notfound' |
  'data' |
  'permissions' |
  'authentication' |
  'timeout' |
  'unavailable';

export type AppErrorOptions<T> =
  ErrorOptions &
  {
    at?: Date | string | number;
    type?: string;
    category?: ErrorCategory;
  } &
  (T extends undefined ?
    { details?: T } :
    { details: T });

type AppErrorJSON = Omit<AppError, 'toJSON' | 'name'> & { $error: 'trv' };

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError<T = Record<string, unknown> | undefined> extends Error {

  static defaultCategory?: ErrorCategory;

  static isJSON(value: unknown): value is AppErrorJSON {
    return typeof value === 'object' && !!value && '$error' in value && value.$error === 'trv';
  }

  /** Convert from JSON object */
  static fromJSON(error: AppErrorJSON): AppError {
    const { $error: _, ...rest } = error;
    const result = new AppError(error.message, castTo<AppErrorOptions<Record<string, unknown>>>(rest));
    result.message = error.message;
    result.stack = error.stack ?? result.stack;
    return result;
  }

  type: string;
  category: ErrorCategory;
  at: Date;
  details: T;

  /**
   * Build an app error
   *
   * @param message The error message
   */
  constructor(
    ...[message, options]:
      T extends undefined ? ([string] | [string, AppErrorOptions<T>]) : [string, AppErrorOptions<T>]
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.type = options?.type ?? this.constructor.name;
    this.details = options?.details!;
    this.category = options?.category ?? castTo<typeof AppError>(this.constructor).defaultCategory ?? 'general';
    this.at = new Date(options?.at ?? Date.now());
  }

  /**
   * Serializes an error to a basic object
   */
  toJSON(includeStack = false): AppErrorJSON {
    return {
      message: this.message,
      $error: 'trv',
      category: this.category,
      ...(this.cause ? { cause: `${this.cause}` } : undefined),
      type: this.type,
      at: this.at,
      ...(this.details ? { details: this.details } : undefined!),
      ...(includeStack ? { stack: this.stack } : undefined)
    };
  }
}