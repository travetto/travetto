import { Env } from '@travetto/base';

import { LogEvent, LogListener, LogLevel, LogLevels } from '../types';
import { consoleOutput } from '../output';
import { lineFormatter } from '../formatter';

class $Logger {

  private listeners: LogListener[] = [];

  private _level: number = (Env.dev || Env.e2e) ? LogLevels.debug : LogLevels.info;

  _init() {
    // Base logger, for free
    const formatter = lineFormatter({});
    const output = consoleOutput({});

    this.listen(e => output(formatter(e)));
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

    if (LogLevels[event.level!] < this._level) {
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
    return LogLevels[level] >= this._level;
  }
}

export const Logger = new $Logger();