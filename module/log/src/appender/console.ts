import { LogLevel } from '@travetto/base';
import { Appender } from '../types';

/**
 * Console logging config
 */
export interface ConsoleAppenderOpts {
}

/**
 * Console.output
 */
export class ConsoleAppender implements Appender {
  constructor(opts: ConsoleAppenderOpts = {}) { }

  append(level: LogLevel, message: string): void {
    console![level](message);
  }
}
