import { castTo } from './types';

export type ErrorCategory =
  'general' |
  'notfound' |
  'data' |
  'permissions' |
  'authentication' |
  'timeout' |
  'unavailable';

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError<T = unknown> extends Error {

  /** Convert from JSON object */
  static fromJSON(e: unknown): AppError | undefined {
    if (!!e && typeof e === 'object' &&
      ('message' in e && typeof e.message === 'string') &&
      ('category' in e && typeof e.category === 'string') &&
      ('type' in e && typeof e.type === 'string') &&
      ('at' in e && typeof e.at === 'number')
    ) {
      const err = new AppError(e.message, castTo(e.category), 'details' in e ? e.details : undefined);
      err.at = new Date(e.at);
      err.type = e.type;
      return err;
    }
  }

  type: string;
  at = new Date();
  details: T;

  /**
   * Build an app error
   *
   * @param message The error message
   * @param category The error category, can be mapped to HTTP statuses
   * @param details Optional error payload
   */
  constructor(
    message: string,
    public category: ErrorCategory = 'general',
    details?: T

  ) {
    super(message);
    this.type = this.constructor.name;
    this.details = details!;
  }

  /**
   * The format of the JSON output
   */
  toJSON(): { message: string, category: string, type: string, at: string, details?: Record<string, unknown> } {
    return {
      message: this.message,
      category: this.category,
      type: this.type,
      at: this.at.toISOString(),
      details: castTo(this.details),
    };
  }
}