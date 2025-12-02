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
    if (!!error && typeof error === 'object' &&
      ('message' in error && typeof error.message === 'string') &&
      ('category' in error && typeof error.category === 'string') &&
      ('type' in error && typeof error.type === 'string') &&
      ('at' in error && typeof error.at === 'string')
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
    ...[message, opts]:
      T extends undefined ? ([string] | [string, AppErrorOptions<T>]) : [string, AppErrorOptions<T>]
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.type = opts?.type ?? this.constructor.name;
    this.details = opts?.details!;
    this.category = opts?.category ?? castTo<typeof AppError>(this.constructor).defaultCategory ?? 'general';
    this.at = new Date(opts?.at ?? Date.now()).toISOString();
  }

  /**
   * Serializes an error to a basic object
   */
  toJSON(): AppErrorOptions<T> & { message: string } {
    const res: AppErrorOptions<unknown> = {
      category: this.category,
      ...(this.cause ? { cause: `${this.cause}` } : undefined),
      type: this.type,
      at: this.at,
      ...(this.details ? { details: this.details } : undefined!),
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { message: this.message, ...res as AppErrorOptions<T> };
  }
}