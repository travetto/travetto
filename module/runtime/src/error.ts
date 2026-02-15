import { castTo } from './types';

export type ErrorCategory =
  'general' |
  'notfound' |
  'data' |
  'permissions' |
  'authentication' |
  'timeout' |
  'unavailable';

export type AppErrorOptions<T> = Omit<Partial<AppError>, 'details'> & (T extends undefined ? { details?: T } : { details: T });

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError<T = Record<string, unknown> | undefined> extends Error {

  static defaultCategory: ErrorCategory = 'general';

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
}