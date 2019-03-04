import { Env } from '@travetto/base';

import { LogEvent, LogListener, LogLevel, LogLevels } from './types';
import { lineFormatter } from './formatter/line';
import { consoleOutput } from './output/console';

class $Logger {

  private listeners: LogListener[] = [];

  private level: number = Env.trace ? LogLevels.trace : (Env.debug ? LogLevels.debug : LogLevels.info);

  init() {
    // Base logger, for free
    const formatter = lineFormatter({
      colorize: (process.stdout.isTTY && !Env.isTrue('NO_COLOR')) || Env.isTrue('FORCE_COLOR')
    });

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

    if (LogLevels[event.level!] < this.level) {
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
    return LogLevels[level] >= this.level;
  }
}

export const Logger = new $Logger();