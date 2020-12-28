import { EnvUtil } from '@travetto/boot';
import { ConsoleManager, LogLevel, AppManifest } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';
import { MessageContext } from '@travetto/base/src/internal/global-types';

import { Appender, Formatter, LogEvent, LogLevels } from './types';
import { LineFormatter } from './formatter/line';
import { JsonFormatter } from './formatter/json';
import { ConsoleAppender } from './appender/console';
import { LogUtil } from './util';

const DefaultLoggerSym = Symbol.for('@trv:log/default');

type LineContext = { file: string, line: number, scope?: string };

/**
 * Logger service
 */
class $Logger {

  /**
   * Should we enrich the console by default
   */
  private readonly logFormat: 'line' | 'json' = EnvUtil.get('TRV_LOG_FORMAT', 'line') as 'line';

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

    // Build default formatter
    let formatter: Formatter;
    switch (this.logFormat) {
      case 'line': formatter = new LineFormatter(); break;
      case 'json': formatter = new JsonFormatter(); break;
    }
    this.listenDefault(formatter);

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
   * Set default listener
   * @param formatter
   * @param appender Defaults to console appender unless specified
   */
  listenDefault(formatter: Formatter, appender?: Appender) {
    this.listen(DefaultLoggerSym, LogUtil.buildListener(formatter, appender ?? new ConsoleAppender()));
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
  onLog(level: LogLevel, { file, line, scope }: LineContext, [message, context, ...args]: [string, MessageContext, ...any[]]): void {
    level = (level in LogLevels) ? level : 'info';

    const category = SystemUtil.computeModule(file);

    if ((level in this.exclude) || (category && level in this.filters && !this.filters[level]!(category))) {
      return;
    }

    // Allow for controlled order of event properties
    const finalEvent: LogEvent = {
      level,
      message,
      category,
      timestamp: new Date().toISOString(),
      file,
      line,
      context,
      scope,
      args: args.length ? args : undefined
    };

    for (const l of this.listeners) {
      l(finalEvent);
    }
  }
}

export const Logger = new $Logger();