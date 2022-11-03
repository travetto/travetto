import { ConsoleListener, LineContext, LogLevel } from './types';


function wrap(target: Console): ConsoleListener {
  return {
    onLog(level: LogLevel, ctx: LineContext, args: unknown[]): void {
      return target[level](...args);
    }
  };
}

/**
 * Provides a general abstraction against the console.* methods to allow for easier capture and redirection.
 *
 * The transpiler will replace all console.* calls in the typescript files for the framework and those provided by the user.
 * Any console.log statements elsewhere will not be affected.
 */
class $ConsoleManager {

  /**
   * Stack of nested appenders
   */
  #stack: ConsoleListener[] = [];

  /**
   * The current appender
   */
  #appender: ConsoleListener;

  /**
   * List of log levels to exclude
   */
  readonly #exclude = new Set<string>([]);

  /**
   * Unique key to use as a logger function
   */
  constructor() {
    this.#exclude = new Set();

    if (!/^(1|true|yes|on)/i.test(process.env.TRV_DEBUG ?? '')) {
      this.#exclude.add('debug');
    }

    this.set(console); // Init to console
  }

  /**
   * Add exclusion
   * @private
   */
  exclude(val: string, add = true): void {
    if (add) {
      this.#exclude.add(val);
    } else {
      this.#exclude.delete(val);
    }
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(level: LogLevel, ctx: LineContext, ...args: unknown[]): void {
    if (this.#exclude.has(level)) {
      return; // Do nothing
    }
    return this.#appender.onLog(level, ctx, args);
  }

  /**
   * Set a new console appender, works as a stack to allow for nesting
   */
  set(cons: ConsoleListener | Console, replace = false): void {
    cons = ('onLog' in cons) ? cons : wrap(cons);
    if (!replace) {
      this.#stack.unshift(cons);
    } else {
      this.#stack[0] = cons;
    }
    this.#appender = this.#stack[0];
  }

  /**
   * Pop off the logging stack
   */
  clear(): void {
    if (this.#stack.length > 1) {
      this.#stack.shift();
      this.#appender = this.#stack[0];
    }
  }
}

export const ConsoleManager = new $ConsoleManager();

ᚕtrv.log = ConsoleManager.invoke.bind(ConsoleManager);