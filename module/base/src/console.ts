import util from 'node:util';
import debug from 'debug';

import { RuntimeIndex } from '@travetto/manifest';

import type { ConsoleListener, ConsoleEvent, LogLevel } from './types';

const DEBUG_OG = { formatArgs: debug.formatArgs, log: debug.log };

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

  constructor(listener: ConsoleListener) {
    this.set(listener, true);
    this.enhanceDebug(true);
    this.debug(false);
    util.inspect.defaultOptions.depth ??= 4;
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
   * Enable/disable enhanced debugging
   */
  enhanceDebug(active: boolean): void {
    if (active) {
      Error.stackTraceLimit = 50;
      debug.formatArgs = function (args: string[]): void {
        args.unshift(this.namespace);
        args.push(debug.humanize(this.diff));
      };
      debug.log = (modulePath, ...args: string[]): void => this.invoke({
        level: 'debug', module: '@npm:debug', modulePath,
        args: [util.format(...args)], line: 0, source: '', timestamp: new Date()
      });
    } else {
      Error.stackTraceLimit = 10;
      debug.formatArgs = DEBUG_OG.formatArgs;
      debug.log = DEBUG_OG.log;
    }
  }

  /**
   * Set logging debug level
   */
  debug(value: false | string): void {
    if (value !== false) {
      const active = RuntimeIndex.getModuleList('workspace', value || '@');
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

export const ConsoleManager = new $ConsoleManager({ onLog: (ev): void => { console![ev.level](...ev.args); } });
export const log = ConsoleManager.invoke.bind(ConsoleManager);