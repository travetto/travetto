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

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError<T = Record<string, unknown> | undefined> extends Error {

  static defaultCategory?: ErrorCategory;

  /** Convert from JSON object */
  static fromJSON(error: unknown): AppError | undefined {
    if (typeof error === 'object' && !!error &&
      ('message' in error && typeof error.message === 'string') &&
      ('category' in error && typeof error.category === 'string') &&
      ('type' in error && typeof error.type === 'string') &&
      ('at' in error && (typeof error.at === 'string' || error.at instanceof Date))
    ) {
      return new AppError(error.message, castTo<AppErrorOptions<Record<string, unknown>>>(error));
    }
  }

  type: string;
  category: ErrorCategory;
  at: string;
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
    this.at = new Date(options?.at ?? Date.now()).toISOString();
  }

  /**
   * Serializes an error to a basic object
   */
  toJSON(): AppErrorOptions<T> & { message: string } {
    const options: AppErrorOptions<unknown> = {
      category: this.category,
      ...(this.cause ? { cause: `${this.cause}` } : undefined),
      type: this.type,
      at: this.at,
      ...(this.details ? { details: this.details } : undefined!),
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { message: this.message, ...options as AppErrorOptions<T> };
  }
}