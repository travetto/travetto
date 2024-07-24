import util from 'node:util';
import debug from 'debug';

import { RuntimeIndex } from '@travetto/base';

export type ConsoleEvent = {
  /** Time of event */
  timestamp: Date;
  /** The level of the console event */
  level: 'info' | 'warn' | 'debug' | 'error';
  /** The line number the console event was triggered from */
  line: number;
  /** The module name for the source file */
  module: string;
  /** The module path  for the source file*/
  modulePath: string;
  /** The computed scope for the console. statement.  */
  scope?: string;
  /** Arguments passed to the console call*/
  args: unknown[];
};

export interface ConsoleListener {
  log(ev: ConsoleEvent): void;
}

const DEBUG_OG = { formatArgs: debug.formatArgs, log: debug.log };

/**
 * Provides a general abstraction against the console.* methods to allow for easier capture and redirection.
 *
 * The transpiler will replace all console.* calls in the typescript files for the framework and those provided by the user.
 * Any console.log statements elsewhere will not be affected.
 */
class $ConsoleManager implements ConsoleListener {

  /**
   * The current listener
   */
  #listener: ConsoleListener;

  /**
   * List of logging filters
   */
  #filters: Partial<Record<ConsoleEvent['level'], (x: ConsoleEvent) => boolean>> = {};

  constructor(listener: ConsoleListener) {
    this.set(listener);
    this.enhanceDebug(true);
    this.debug(false);
    util.inspect.defaultOptions.depth = Math.max(util.inspect.defaultOptions.depth ?? 0, 4);
  }

  /**
   * Add exclusion
   * @private
   */
  filter(level: ConsoleEvent['level'], filter?: boolean | ((ctx: ConsoleEvent) => boolean)): void {
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
    Error.stackTraceLimit = active ? 50 : 10;
    if (active) {
      debug.formatArgs = function (args: string[]): void {
        args.unshift(this.namespace);
        args.push(debug.humanize(this.diff));
      };
      debug.log = (modulePath, ...args: string[]): void => this.log({
        level: 'debug', module: '@npm:debug', modulePath,
        args: [util.format(...args)], line: 0, timestamp: new Date()
      });
    } else {
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
  log(ev: ConsoleEvent & { import?: [string, string] }): void {
    const outEv = {
      ...ev,
      timestamp: new Date(),
      module: ev.module ?? ev.import?.[0],
      modulePath: ev.modulePath ?? ev.import?.[1]
    };

    if (this.#filters[outEv.level] && !this.#filters[outEv.level]!(outEv)) {
      return; // Do nothing
    } else {
      return this.#listener.log(outEv);
    }
  }

  /**
   * Set a new console listener
   */
  set(cons: ConsoleListener): void {
    this.#listener = cons;
  }

  /**
   * Get the listener
   */
  get(): ConsoleListener {
    return this.#listener;
  }
}

export const ConsoleManager = new $ConsoleManager({ log(ev): void { console![ev.level](...ev.args); } });
export const log = ConsoleManager.log.bind(ConsoleManager);