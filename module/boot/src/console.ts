import { ModuleIndex } from './module-index';
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
   * List of logging filters
   */
  #filters: Partial<Record<LogLevel, (x: LineContext) => boolean>> = {};

  /**
   * Unique key to use as a logger function
   */
  constructor() {
    this.set(console); // Init to console
    this.setDebug(process.env.TRV_DEBUG ?? '');
  }

  /**
   * Add exclusion
   * @private
   */
  filter(level: LogLevel, filter?: boolean | ((ctx: LineContext) => boolean)): void {
    if (filter !== undefined) {
      if (typeof filter === 'boolean') {
        const v = filter;
        filter = (): boolean => v;
      }
      this.#filters[level] = filter;
    } else {
      delete this.#filters[level];
    }
  }

  /**
   * Set logging debug level
   */
  setDebug(debug: boolean | string): void {
    const isSet = debug !== undefined && debug !== '';
    const isFalse = typeof debug === 'boolean' ? !debug : /^(0|false|no|off)/i.test(debug);

    if (isSet && !isFalse) {
      const filter = ModuleIndex.buildModuleFilter(typeof debug === 'string' ? debug : '', 'local');
      this.filter('debug', ctx => filter(ctx.module));
    } else {
      this.filter('debug', () => false);
    }
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(level: LogLevel, ctx: LineContext, ...args: unknown[]): void {
    // Resolve input to source file
    ctx.source = ModuleIndex.getSourceFile(ctx.source);
    const mod = ModuleIndex.getModuleFromSource(ctx.source)!;
    ctx.module = mod.name;
    ctx.modulePath = ctx.source.split(mod.source)[1];

    if (this.#filters[level] && !this.#filters[level]!(ctx)) {
      return; // Do nothing
    } else {
      return this.#appender.onLog(level, ctx, args);
    }
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