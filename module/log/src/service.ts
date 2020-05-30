import { ColorUtil, EnvUtil } from '@travetto/boot';
import { ConsoleManager, LogLevel, ConsolePayload, AppManifest } from '@travetto/base';

import { LogEvent, LogLevels } from './types';
import { LineFormatter } from './formatter/line';
import { ConsoleAppender } from './appender/console';
import { LogUtil } from './util';

const DEFAULT = Symbol.for('@trv:log/default');

/**
 * Logger service
 */
class $Logger {

  /**
   * Listeners for logging events
   */
  private listenerMap = new Map<string | symbol, (ev: LogEvent) => void>();
  /**
   * List of all listeners
   */
  private listeners: ((ev: LogEvent) => void)[] = [];

  /**
   * List of logging filters
   */
  private filters: Partial<Record<LogLevel, (x: string) => boolean>> = {};
  /**
   * Which log levels to exclude
   */
  private exclude: Partial<Record<LogLevel, boolean>> = { debug: true };
  /**
   * Initialize
   */
  init() {
    if (AppManifest.debug.status !== false) {
      delete this.exclude.debug;
      const filter = LogUtil.buildFilter(AppManifest.debug.value ?? '@app');
      if (filter) {
        this.filters.debug = filter;
      }
    }

    // Base logger, for free
    const formatter = new LineFormatter({
      colorize: ColorUtil.colorize,
      timestamp: ConsoleManager.timestamp
    });

    // Register default listener
    this.listen(DEFAULT, LogUtil.buildListener(
      formatter,
      new ConsoleAppender({ method: 'log' }),
      ({ level: x }) => x === 'info' || x === 'debug')
    );

    this.listen(DEFAULT, LogUtil.buildListener(
      formatter,
      new ConsoleAppender({ method: 'error' }),
      ({ level: x }) => x === 'error' || x === 'warn' || x === 'fatal')
    );

    ConsoleManager.set(this, true); // Make default
  }

  /**
   * Add log event listener
   */
  listen(key: string | symbol, handler: (ev: LogEvent) => void) {
    this.listenerMap.set(key, handler);
    this.listeners.push(handler);
  }

  /**
   * Clear all listeners
   */
  removeAll() {
    this.listenerMap.clear();
    this.listeners = [];
  }

  /**
   * Remove specific listener
   */
  removeListener(key: string | symbol) {
    const handler = this.listenerMap.get(key);
    if (handler) {
      this.listenerMap.delete(key);
      this.listeners.splice(this.listeners.indexOf(handler), 1);
    }
  }

  /**
   * See if log level is enabled
   */
  enabled(level: LogLevel): boolean {
    return !(level in this.exclude);
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  invoke(event: ConsolePayload & Partial<LogEvent>, rest: any[]): void {
    if (!('message' in event)) {
      const message = (rest.length && typeof rest[0] === 'string') ? rest.shift() : undefined;
      event.message = message;
    }

    if (rest.length && !event.args) {
      event.args = rest;
    }

    event.level = (event.level in LogLevels) ? event.level : 'info';

    if ((event.level in this.exclude) || (event.level in this.filters && !this.filters[event.level]!(event.category!))) {
      return;
    }

    event.timestamp = Date.now();

    // Use sliced values
    event.args = (event.args ?? []).slice(0);

    for (const l of this.listeners) {
      l(event as LogEvent);
    }
  }
}

export const Logger = new $Logger();