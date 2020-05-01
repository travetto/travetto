import { StacktraceUtil } from './stacktrace';
import { Env } from './env';

/**
 * Mapping from error category to standard http error codes
 */
const ERROR_CATEGORIES_WITH_CODES = {
  general: [500, 501],
  notfound: [404, 416],
  data: [400, 411, 414, 415, 431, 417, 428],
  permissions: [403],
  authentication: [401, 407, 511],
  timeout: [408, 504],
  unavailable: [503, 502, 429]
};

export type ErrorCategory = keyof typeof ERROR_CATEGORIES_WITH_CODES;

/**
 * Provides a mapping from error code to category and vice-versa
 */
export const HTTP_ERROR_CONVERSION = (Object.entries(ERROR_CATEGORIES_WITH_CODES) as [ErrorCategory, number[]][])
  .reduce(
    (acc, [typ, codes]) => {
      codes.forEach(c => acc.to.set(c, typ));
      acc.from.set(typ, codes[0]);
      return acc;
    },
    {
      to: new Map<number, ErrorCategory>(),
      from: new Map<ErrorCategory, number>()
    }
  );

/**
 * Framework error class, with the aim of being extensible
 */
export class AppError extends Error {
  static build(e: any, cat: ErrorCategory = 'general') {
    if (e instanceof AppError) {
      return e;
    }
    const out = new AppError(e.message, cat);
    // Copy stack to ensure long stack trace support
    if (e.stack) {
      out.stack = e.stack;
    }
    return out;
  }

  type: string;

  constructor(
    public message: string,
    public category: ErrorCategory = 'general',
    public payload?: Record<string, any>,

  ) {
    super(message);
    this.type = this.constructor.name;
    this.stack = this.stack; // eslint-disable-line no-self-assign
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