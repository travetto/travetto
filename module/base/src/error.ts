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
export class AppError extends Error {

  /** Is the object in the shape of an error */
  static isErrorLike(val: unknown): val is AppError {
    return !!val && (typeof val === 'object' || typeof val === 'function') &&
      'message' in val && 'category' in val && 'type' in val && 'at' in val;
  }

  /** Convert from JSON object */
  static fromErrorLike(e: AppError): AppError {
    const err = new AppError(e.message, e.category, e.details);
    err.at = e.at;
    err.type = e.type;
    return err;
  }

  type: string;
  at = new Date();

  /**
   * Build an app error
   *
   * @param message The error message
   * @param category The error category, can be mapped to HTTP statuses
   * @param details Optional error payload
   * @param stack A stack to override if needed
   */
  constructor(
    message: string,
    public category: ErrorCategory = 'general',
    public details?: Record<string, unknown>,
    stack?: string

  ) {
    super(message);
    this.type = this.constructor.name;
    this.stack = stack || this.stack; // eslint-disable-line no-self-assign
  }

  /**
   * The format of the JSON output
   * @param extra Extra data to build into the context
   */
  toJSON(): unknown {
    return {
      message: this.message,
      category: this.category,
      type: this.type,
      at: this.at,
      details: this.details,
    };
  }
}