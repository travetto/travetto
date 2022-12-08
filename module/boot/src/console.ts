import util from 'util';

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
 * Registers handler for `debug` module in npm ecosystem
 * @param mgr
 */
async function initNpmDebug(mgr: $ConsoleManager): Promise<void> {
  try {
    const { default: debug } = await import('debug');
    debug.formatArgs = function (args: string[]): void {
      args.unshift(this.namespace);
      args.push(debug.humanize(this.diff));
    };
    debug.log = (...args: string[]): void => mgr.invoke('debug', {
      line: 0,
      module: '@npm:debug',
      modulePath: args[0],
      source: __output,
    }, util.format(...args.slice(1)));
  } catch (err) {
    console.log(err);
  }
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

  get lineWidth(): number {
    return +(process.env.TRV_CONSOLE_WIDTH ?? process.stdout.columns ?? 120);
  }

  async init(): Promise<this> {
    this.set(console); // Init to console
    this.setDebugFromEnv();
    await initNpmDebug(this);
    return this;
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

  setDebugFromEnv(): void {
    const notProd = !/prod/i.test(process.env.NODE_ENV ?? '');
    this.setDebug(process.env.DEBUG ?? (notProd ? '@local' : false));
  }

  /**
   * Set logging debug level
   */
  setDebug(debug: boolean | string): void {
    const isSet = debug !== undefined && debug !== '';
    const isFalse = typeof debug === 'boolean' ? !debug : /^(0|false|no|off)/i.test(debug);

    if (isSet && !isFalse) {
      const active = ModuleIndex.getModuleList('local', typeof debug === 'string' ? debug : '');
      active.add('@npm:debug');
      this.filter('debug', ctx => active.has(ctx.module));

    } else {
      this.filter('debug', () => false);
    }
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(level: LogLevel, ctx: LineContext, ...args: unknown[]): void {
    // Resolve input to source file
    const source = ModuleIndex.getSourceFile(ctx.source);
    const mod = ModuleIndex.getModuleFromSource(source);
    const outCtx = {
      ...ctx,
      source,
      module: ctx.module ?? mod!.name,
      modulePath: ctx.modulePath ?? (mod ? source.split(`${mod.source}/`)[1] : '')
    };

    if (this.#filters[level] && !this.#filters[level]!(outCtx)) {
      return; // Do nothing
    } else {
      return this.#appender.onLog(level, outCtx, args);
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