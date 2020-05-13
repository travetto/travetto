import { StacktraceUtil } from './stacktrace';
import { Env } from './env';
import { ErrorCategory } from './internal/error';
export { ErrorCategory } from './internal/error'; // Re-export

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError extends Error {

  type: string;

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
   * Console pretty printing
   */
  toConsole(sub?: string) {
    sub = sub || (this.payload ? `${JSON.stringify(this.payload, null, 2)}\n` : '');
    return super.toConsole!(sub);
  }

  /**
   * The format of the JSON output
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

// Add .toConsole to the default Error as well
(Error as any).prototype.toConsole = function (mid: any = '') {
  const stack = Env.trace ? this.stack : StacktraceUtil.simplifyStack(this);
  return `${this.message}\n${mid}${stack.substring(stack.indexOf('\n') + 1)}`;
};