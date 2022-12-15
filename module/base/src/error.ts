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

  type: string;
  at = new Date();

  /**
   * Build an app error
   *
   * @param message The error message
   * @param category The error category, can be mapped to HTTP statuses
   * @param payload Optional error payload
   * @param stack A stack to override if needed
   */
  constructor(
    message: string,
    public category: ErrorCategory = 'general',
    public payload?: Record<string, unknown>,
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
    const out: Record<string, unknown> = {
      message: this.message,
      category: this.category,
      type: this.type,
      at: this.at,
    };
    if (this.payload) {
      for (const [key, value] of Object.entries(this.payload)) {
        if (!(key in out)) {
          out[key] = value;
        }
      }
    }
    return out;
  }
}