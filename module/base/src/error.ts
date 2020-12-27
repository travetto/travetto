/// <reference path="./internal/global-types.d.ts" />

import { ErrorCategory } from './internal/error';
export { ErrorCategory } from './internal/error'; // Re-export

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError extends Error {

  type: string;

  /**
   * Build an app error
   *
   * @param message The error message
   * @param category The error category, can be mapped to HTTP statuses
   * @param payload Optional error payload
   * @param stack A stack to override if needed
   */
  constructor(
    public message: string,
    public category: ErrorCategory = 'general',
    public payload?: Record<string, any>,
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
  toJSON(extra: Record<string, any> = {}) {
    return {
      ...extra,
      ...(this.payload ?? {}),
      message: this.message,
      category: this.category,
      type: this.type
    };
  }
}