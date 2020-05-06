import { Env, ConsoleManager, ConsolePayload } from '@travetto/base';

import { LogEvent, LogListener, LogLevels, LogLevel, LogStream } from './types';
import { LineFormatter } from './formatter/line';
import { ConsoleOutput } from './output/console';
import { LogUtil } from './util';

const DEFAULT = Symbol.for('_trv_log_default');

// TODO: Document
class $Logger {

  private listeners = new Map<string | symbol, LogListener>();
  private listenList: LogListener[] = [];

  private filters: Record<string, (x: string) => boolean> = {};
  private exclude: Record<string, boolean> = { debug: true, trace: true };
  private flags: { debug?: string, trace?: string };

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
    this.listen();
  }

  listen({ formatter, stdout, stderr, key }: Partial<LogStream> = {}) {
    formatter = formatter ?? new LineFormatter({
      colorize: Env.colorize,
      timestamp: ConsoleManager.timestamp,
      timeMillis: ConsoleManager.timeMillis
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

  listenRaw(key: string | symbol, handler: (ev: LogEvent) => void) {
    this.listeners.set(key ?? DEFAULT, handler);
    this.listenList = [...this.listeners.values()];
  }

  removeAll() {
    this.listeners.clear();
    this.listenList = [];
  }

  removeListener(key: string | symbol) {
    this.listeners.delete(key);
    this.listenList = [...this.listeners.values()];
  }

  enabled(level: LogLevel): boolean {
    return !(level in this.exclude);
  }

  invoke(event: ConsolePayload & Partial<LogEvent>, rest: any[]): void {
    if (!('message' in event)) {
      const message = (rest.length && typeof rest[0] === 'string') ? rest.shift() : undefined;
      event.message = message;
    }

    if (rest.length && !event.args) {
      event.args = rest;
    }

    event.level = (event.level! in LogLevels) ? event.level : 'info';

    if ((event.level! in this.exclude) || (event.level! in this.filters && !this.filters[event.level!](event.category!))) {
      return;
    }

    event.timestamp = Date.now();

    const args = (event.args ?? []).slice(0);
    const last = args[args.length - 1];

    if (last && Object.keys(last).length === 1 && last.meta) { // Handle meta
      event.meta = args.pop().meta;
    }

    // Use sliced values
    event.args = args;

    for (const l of this.listenList) {
      l(event as LogEvent);
    }
  }
}

export const Logger = new $Logger();