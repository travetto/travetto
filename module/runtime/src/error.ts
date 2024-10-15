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
      ('at' in e && typeof e.at === 'string')
    ) {
      return new AppError(e.message, castTo(e));
    }
  }

  type: string;
  category: ErrorCategory;
  at: string;
  details?: T;

  /**
   * Build an app error
   *
   * @param message The error message
   */
  constructor(message: string, opts: AppErrorOptions<T> = {}) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.type = opts.type ?? this.constructor.name;
    this.details = opts.details;
    this.category = opts.category ?? 'general';
    this.at = new Date(opts.at ?? Date.now()).toISOString();
  }

  /**
   * Serializes an error to a basic object
   */
  toJSON(): AppErrorOptions<T> & { message: string } {
    return {
      message: this.message,
      category: this.category,
      ...(this.cause ? { cause: `${this.cause}` } : undefined),
      type: this.type,
      at: this.at,
      ...(this.details ? { details: this.details } : undefined),
    };
  }
}