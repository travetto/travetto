import { Env } from '@travetto/base';

import { LogEvent, LogListener, LogLevel, LogLevels } from './types';
import { lineFormatter } from './formatter/line';
import { consoleOutput } from './output/console';
import { LogUtil } from './util';

class $Logger {

  static COLORIZE = (process.stdout.isTTY && !Env.isTrue('NO_COLOR')) || Env.isTrue('FORCE_COLOR');

  private listeners: LogListener[] = [];

  private filters: { [key: string]: (x: string) => boolean } = {};
  private exclude: { [key: string]: boolean } = {
    debug: true,
    trace: true
  };

  init() {

    const flags = {
      debug: LogUtil.readEnvVal('debug', Env.dev ? '*' : ''),
      trace: LogUtil.readEnvVal('trace'),
    };

    for (const k of ['debug', 'trace'] as ['debug', 'trace']) {
      const filter = LogUtil.buildFilter(flags[k]);
      if (filter !== LogUtil.falsehood) {
        delete this.exclude[k];
        if (filter !== LogUtil.truth) {
          this.filters[k] = filter;
        }
      }
    }

    // Base logger, for free
    const formatter = lineFormatter({ colorize: $Logger.COLORIZE });
    const errorOutput = consoleOutput({ method: 'error' });
    const output = consoleOutput({ method: 'log' });

    this.listen(ev => {
      const msg = formatter(ev);
      if (ev.level === 'error' || ev.level === 'fatal') {
        errorOutput(msg);
      } else {
        output(msg);
      }
    });
  }

  removeAll() {
    this.listeners = [];
  }

  listen(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners.splice(this.listeners.indexOf(listener), 1);
    };
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

    for (const l of this.listeners) {
      l(event as LogEvent);
    }
  }

  enabled(level: LogLevel): boolean {
    return !(level in this.exclude);
  }
}

export const Logger = new $Logger();