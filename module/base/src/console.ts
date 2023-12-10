import util from 'node:util';

import { RuntimeIndex } from '@travetto/manifest';

import type { ConsoleListener, ConsoleEvent, LogLevel } from './types';

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

  /**
   * Register as primary listener for entire app
   * @private
   */
  async register(cfg: { debug?: false | string, overwriteNpmDebug?: boolean } = {}): Promise<this> {
    this.debug(cfg.debug ?? false);

    Error.stackTraceLimit = 50;

    // Commandeer debug
    if (cfg.overwriteNpmDebug ?? true) {
      try {
        const { default: debug } = await import('debug');
        debug.formatArgs = function (args: string[]): void {
          args.unshift(this.namespace);
          args.push(debug.humanize(this.diff));
        };
        debug.log = (modulePath, ...args: string[]): void => this.invoke({
          level: 'debug', module: '@npm:debug', modulePath,
          args: [util.format(...args)], line: 0, source: '', timestamp: new Date()
        });
      } catch (err) {
        // Do nothing
      }
    }

    // Take ownership of console
    this.set({ onLog: ev => { console![ev.level](...ev.args); } }, true);
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

  /**
   * Set logging debug level
   */
  debug(value: false | string): void {
    if (value !== false) {
      const active = RuntimeIndex.getModuleList('local', value || '@');
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
    const source = ev.source ? RuntimeIndex.getSourceFile(ev.source) : RuntimeIndex.mainModule.outputPath;
    const mod = RuntimeIndex.getModuleFromSource(source);
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
  set(cons: ConsoleListener, replace = false): void {
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