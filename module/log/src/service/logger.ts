import * as util from 'util';

import { LogEvent, LogListener, LogLevel, LogLevels } from '../types';
import { AppEnv } from '@travetto/base';
import { consoleOutput } from '../output';
import { lineFormatter } from '../formatter';

class $Logger {

  private listeners: LogListener[] = [];

  private _level: number = LogLevels.info;

  _init() {
    const override = process.env.LOG_CONSOLE === '1';
    const quiet = !!process.env.QUIET || process.env.LOG_CONSOLE === '0';
    const show = AppEnv.test ? override : !quiet;

    // Base logger, for free
    if (show) {
      const formatter = lineFormatter({});
      const output = consoleOutput({});

      this.listen(e => output(formatter(e)));
    }
  }

  removeAll() {
    this.listeners = [];
  }

  listen(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners.splice(this.listeners.indexOf(listener), 1);
    }
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

    if (last) {
      if (Object.keys(last).length === 1 && last.meta) { // Handle meta
        event.meta = args.pop().meta;
      } else if (last.stack) { // Handle error
        args[args.length - 1] = last.stack;
      }
    }

    for (const l of this.listeners) {
      l(event as LogEvent);
    }
  }

  enabled(level: LogLevel): boolean {
    return LogLevels[level] >= this._level;
  }
}

export const Logger = new $Logger();