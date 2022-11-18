import { LogLevel, LineContext, ConsoleListener } from '@travetto/boot';
import { Env, Util } from '@travetto/base';

import { Appender, Formatter, LogEvent, LogLevels } from './types';
import { LineFormatter } from './formatter/line';
import { JsonFormatter } from './formatter/json';
import { ConsoleAppender } from './appender/console';
import { FileAppender } from './appender/file';
import { LogUtil } from './util';

const DefaultLoggerⲐ = Symbol.for('@trv:log/default');

/**
 * Logger service
 */
class $Logger implements ConsoleListener {

  /**
   * Should we enrich the console by default
   */
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  readonly #logFormat: 'line' | 'json' = Env.get('TRV_LOG_FORMAT', 'line') as 'line';

  /**
   * Log file, if needed
   */
  readonly #logFile?: string = Env.get('TRV_LOG_FILE');

  /**
   * Listeners for logging events
   */
  #listenerMap = new Map<string | symbol, (ev: LogEvent) => void>();
  /**
   * List of all listeners
   */
  #listeners: ((ev: LogEvent) => void)[] = [];

  /**
   * List of logging filters
   */
  #filters: Partial<Record<LogLevel, (x: string) => boolean>> = {};

  constructor() {
    if (!this.#listenerMap.get(DefaultLoggerⲐ)) {
      // Build default formatter
      let formatter: Formatter;
      switch (this.#logFormat) {
        case 'line': formatter = new LineFormatter(); break;
        case 'json': formatter = new JsonFormatter(); break;
      }
      this.listenDefault(formatter, this.#logFile ? new FileAppender({ file: this.#logFile }) : undefined);
    }
  }

  setDebug(value: boolean | string): void {
    if (typeof value === 'boolean') {
      if (value) {
        this.#filters.debug = LogUtil.buildFilter('@app');
      }
    } else {
      this.#filters.debug = LogUtil.buildFilter(value || '@app');
    }
  }

  /**
   * Add log event listener
   */
  listen(key: string | symbol, handler: (ev: LogEvent) => void): void {
    this.removeListener(key);
    this.#listenerMap.set(key, handler);
    this.#listeners.push(handler);
  }

  /**
   * Set default listener
   * @param formatter
   * @param appender Defaults to console appender unless specified
   */
  listenDefault(formatter: Formatter, appender?: Appender): void {
    this.listen(DefaultLoggerⲐ, LogUtil.buildListener(formatter, appender ?? new ConsoleAppender()));
  }

  /**
   * Clear all listeners
   */
  removeAll(): void {
    this.#listenerMap.clear();
    this.#listeners = [];
  }

  /**
   * Remove specific listener
   */
  removeListener(key: string | symbol): void {
    const handler = this.#listenerMap.get(key);
    if (handler) {
      this.#listenerMap.delete(key);
      this.#listeners.splice(this.#listeners.indexOf(handler), 1);
    }
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  onLog(level: LogLevel, { file, category, line, scope }: LineContext, [message, context, ...args]: [string, Record<string, unknown>, ...unknown[]]): void {
    level = (level in LogLevels) ? level : 'info';

    if (!Util.isPlainObject(context)) {
      args.unshift(context);
      context = {};
    }

    if (typeof message !== 'string') {
      args.unshift(message);
      message = '';
    }

    if (category && this.#filters[level] && !this.#filters[level]?.(category)) {
      return;
    }

    // Allow for controlled order of event properties
    const finalEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      file,
      line,
      category,
      scope,
      message: message !== '' ? message : undefined,
      context,
      args: args.filter(x => x !== undefined)
    };

    for (const l of this.#listeners) {
      l(finalEvent);
    }
  }
}

export const Logger = new $Logger();