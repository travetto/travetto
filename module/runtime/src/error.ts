import { castTo } from './types';

export type ErrorCategory =
  'general' |
  'notfound' |
  'data' |
  'permissions' |
  'authentication' |
  'timeout' |
  'unavailable';

export type AppErrorOptions<T> = ErrorOptions & {
  at?: Date | string | number;
  type?: string;
  category?: ErrorCategory;
  details?: T;
};

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError<T = Record<string, unknown>> extends Error {

  /** Convert from JSON object */
  static fromJSON(e: unknown): AppError | undefined {
    if (!!e && typeof e === 'object' &&
      ('message' in e && typeof e.message === 'string') &&
      ('category' in e && typeof e.category === 'string') &&
      ('type' in e && typeof e.type === 'string') &&
      ('at' in e && (typeof e.at === 'number' || typeof e.at === 'string' || e.at instanceof Date))
    ) {
      const err = new AppError(e.message, castTo(e));
      return err;
    }
  }

  type: string;
  category: ErrorCategory;
  at: Date;
  details?: T;

  /**
   * Build an app error
   *
   * @param message The error message
   * @param category The error category, can be mapped to HTTP statuses
   * @param details Optional error payload
   */
  constructor(message: string, opts: AppErrorOptions<T> = {}) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.type = opts.type ?? this.constructor.name;
    this.details = opts.details;
    this.category = opts.category ?? 'general';
    this.at = opts.at ? (opts.at instanceof Date ? opts.at : new Date(opts.at)) : new Date();
  }

  /**
   * The format of the JSON output
   */
  toJSON(): Omit<AppError, 'at' | 'toJSON' | 'name'> & { at: string } {
    return {
      message: this.message,
      category: this.category,
      cause: this.cause ? `${this.cause}` : undefined,
      type: this.type,
      at: this.at.toISOString(),
      details: castTo(this.details),
    };
  }
}