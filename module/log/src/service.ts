import { ColorUtil } from '@travetto/boot';
import { Env, ConsoleManager, LogLevel, ConsolePayload } from '@travetto/base';

import { LogEvent, LogLevels, LogStream } from './types';
import { LineFormatter } from './formatter/line';
import { ConsoleOutput } from './output/console';
import { LogUtil } from './util';

const DEFAULT = Symbol.for('@trv:log/default');

/**
 * Logger service
 */
class $Logger {

  /**
   * Listeners for logging events
   */
  private listeners = new Map<string | symbol, (ev: LogEvent) => void>();
  /**
   * List of all listeners
   */
  private listenList: ((ev: LogEvent) => void)[] = [];

  /**
   * List of logging filters
   */
  private filters: Partial<Record<LogLevel, (x: string) => boolean>> = {};
  /**
   * Which log levels to exclude
   */
  private exclude: Partial<Record<LogLevel, boolean>> = { debug: true, trace: true };
  /**
   * Which flags
   */
  private flags: { debug?: string, trace?: string };
  /**
   * Initialize
   */
  init() {
    this.flags = {
      debug: LogUtil.readEnvVal('debug', !Env.prod ? '*' : ''),
      trace: LogUtil.readEnvVal('trace'),
    };

    for (const k of ['debug', 'trace'] as ['debug', 'trace']) {
      const filter = LogUtil.buildFilter(this.flags[k]);
      if (filter !== LogUtil.falsehood) {
        delete this.exclude[k];
        if (filter !== LogUtil.truth) {
          this.filters[k] = filter;
        }
      }
    }

    // Base logger, for free
    ConsoleManager.set(this);
    this.listen(); // Register console listener
  }

  /**
   * Regigster a new listener with default support for formatters and output mechanisms
   */
  listen({ formatter, stdout, stderr, key }: Partial<LogStream> = {}) {
    formatter = formatter ?? new LineFormatter({
      colorize: ColorUtil.colorize,
      timestamp: ConsoleManager.timestamp
    });

    stderr = stderr ?? new ConsoleOutput({ method: 'error' });
    stdout = stdout ?? new ConsoleOutput({ method: 'log' });

    this.listenRaw(key ?? DEFAULT, (ev: LogEvent) => {
      const msg = formatter!.format(ev);
      if (ev.level === 'error' || ev.level === 'fatal' || ev.level === 'warn') {
        stderr!.output(msg);
      } else {
        stdout!.output(msg);
      }
    });
  }

  /**
   * Listen directly without any support
   */
  listenRaw(key: string | symbol, handler: (ev: LogEvent) => void) {
    this.listeners.set(key ?? DEFAULT, handler);
    this.listenList = [...this.listeners.values()];
  }

  /**
   * Clear all listeners
   */
  removeAll() {
    this.listeners.clear();
    this.listenList = [];
  }

  /**
   * Remove specific listener
   */
  removeListener(key: string | symbol) {
    this.listeners.delete(key);
    this.listenList = [...this.listeners.values()];
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

    event.level = (event.level! in LogLevels) ? event.level : 'info';

    if ((event.level! in this.exclude) || (event.level! in this.filters && !this.filters[event.level!]!(event.category!))) {
      return;
    }

    event.timestamp = Date.now();

    // Use sliced values
    event.args = (event.args ?? []).slice(0);

    for (const l of this.listenList) {
      l(event as LogEvent);
    }
  }
}

export const Logger = new $Logger();