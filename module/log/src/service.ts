import { Env } from '@travetto/base/bootstrap';

import { LogEvent, LogListener, LogLevel, LogLevels, LogStream } from './types';
import { LineFormatter } from './formatter/line';
import { ConsoleOutput } from './output/console';
import { LogUtil } from './util';

const DEFAULT = Symbol('default');

class $Logger {

  static COLORIZE = (process.stdout.isTTY && !Env.isTrue('NO_COLOR')) || Env.isTrue('FORCE_COLOR');

  private listeners = new Map<string | symbol, LogListener>();
  private listenList: LogListener[] = [];

  private filters: { [key: string]: (x: string) => boolean } = {};
  private exclude: { [key: string]: boolean } = { debug: true, trace: true };
  private flags: { debug?: string, trace?: string };

  init() {
    this.flags = {
      debug: LogUtil.readEnvVal('debug', Env.dev ? '*' : ''),
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
    this.listen();
  }

  listen({ formatter, stdout, stderr, key }: Partial<LogStream> = {}) {
    formatter = formatter || new LineFormatter({
      colorize: $Logger.COLORIZE,
      timestamp: !Env.isFalse('log_time'),
      time_millis: !!this.flags.trace
    });

    stderr = stderr || new ConsoleOutput({ method: 'error' });
    stdout = stdout || new ConsoleOutput({ method: 'log' });

    this.listenRaw(key || DEFAULT, (ev: LogEvent) => {
      const msg = formatter!.format(ev);
      if (ev.level === 'error' || ev.level === 'fatal') {
        stderr!.output(msg);
      } else {
        stdout!.output(msg);
      }
    });
  }

  listenRaw(key: string | symbol, handler: (ev: LogEvent) => void) {
    this.listeners.set(key || DEFAULT, handler);
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

  log(level: LogLevel, message: string, ...args: any[]): void;
  log(event: Partial<LogEvent>): void;
  log(event: LogLevel | Partial<LogEvent>, ...rest: any[]): void {
    if (typeof event === 'string') {
      const message = rest.length && typeof rest[0] === 'string' ? rest.shift() : undefined;
      this.log({
        level: event,
        message,
        args: rest
      });
      return;
    }

    event.level = (event.level! in LogLevels) ? event.level : 'info';

    if ((event.level! in this.exclude) || (event.level! in this.filters && !this.filters[event.level!](event.category!))) {
      return;
    }

    event.timestamp = Date.now();

    const args = (event.args || []).slice(0);
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