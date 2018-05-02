import * as util from 'util';

import { Injectable } from '@travetto/di';
import { AppInfo } from '@travetto/base';
import { LogEvent, LogListener, LogLevel, LogLevels } from '../types';

export class Logger {

  private static listeners: LogListener[] = [];

  private static _level: number = LogLevels.info;

  static listen(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners.splice(this.listeners.indexOf(listener), 1);
    }
  }

  // constructor(private config: LoggerConfig) { }

  static log(event: Partial<LogEvent>): void {
    event.level = (event.level! in LogLevels) ? event.level : 'info';
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

  static enabled(level: LogLevel): boolean {
    return LogLevels[level] <= this._level;
  }
}
