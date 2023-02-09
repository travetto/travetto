import util from 'util';

import { RootIndex } from '@travetto/manifest';

import type { ConsoleListener, ConsoleEvent, LogLevel } from './types';

function wrap(target: Console): ConsoleListener {
  return {
    onLog(ev: ConsoleEvent): void {
      return target[ev.level](...ev.args);
    }
  };
}

// TODO: Externalize?
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
    debug.log = (modulePath, ...args: string[]): void => mgr.invoke({
      level: 'debug', module: '@npm:debug', modulePath,
      args: [util.format(...args)], line: 0, source: '', timestamp: new Date()
    });
  } catch (err) {
    // Do nothing
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
   * Stack of nested listeners
   */
  #stack: ConsoleListener[] = [];

  /**
   * The current listener
   */
  #listener: ConsoleListener;

  /**
   * List of logging filters
   */
  #filters: Partial<Record<LogLevel, (x: ConsoleEvent) => boolean>> = {};

  async register(): Promise<this> {
    this.set(console); // Init to console
    this.setDebugFromEnv();
    await initNpmDebug(this);
    return this;
  }

  /**
   * Add exclusion
   * @private
   */
  filter(level: LogLevel, filter?: boolean | ((ctx: ConsoleEvent) => boolean)): void {
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
    this.setDebug(process.env.DEBUG ?? (notProd ? '@' : false));
  }

  /**
   * Set logging debug level
   */
  setDebug(debug: boolean | string): void {
    const isSet = debug !== undefined && debug !== '';
    const isFalse = typeof debug === 'boolean' ? !debug : /^(0|false|no|off)/i.test(debug);

    if (isSet && !isFalse) {
      const active = RootIndex.getModuleList('local', typeof debug === 'string' ? debug : '');
      active.add('@npm:debug');
      this.filter('debug', ctx => active.has(ctx.module));

    } else {
      this.filter('debug', () => false);
    }
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(ev: ConsoleEvent): void {
    // Resolve input to source file
    const source = ev.source ? RootIndex.getSourceFile(ev.source) : RootIndex.mainModule.output;
    const mod = RootIndex.getModuleFromSource(source);
    const outEv = {
      ...ev,
      timestamp: new Date(),
      source,
      module: ev.module ?? mod?.name,
      modulePath: ev.modulePath ?? (mod ? source.split(`${mod.sourceFolder}/`)[1] : '')
    };

    if (this.#filters[outEv.level] && !this.#filters[outEv.level]!(outEv)) {
      return; // Do nothing
    } else {
      return this.#listener.onLog(outEv);
    }
  }

  /**
   * Set a new console listener, works as a stack to allow for nesting
   */
  set(cons: ConsoleListener | Console, replace = false): void {
    cons = ('onLog' in cons) ? cons : wrap(cons);
    if (!replace) {
      this.#stack.unshift(cons);
    } else {
      this.#stack[0] = cons;
    }
    this.#listener = this.#stack[0];
  }

  /**
   * Pop off the logging stack
   */
  clear(): void {
    if (this.#stack.length > 1) {
      this.#stack.shift();
      this.#listener = this.#stack[0];
    }
  }
}

export const ConsoleManager = new $ConsoleManager();
export const log = ConsoleManager.invoke.bind(ConsoleManager);