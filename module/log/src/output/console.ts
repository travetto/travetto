import { Appender } from '../types';

/**
 * Console logging config
 */
export interface ConsoleAppenderOpts {
  method: 'log' | 'error';
}

/**
 * Console.output
 */
export class ConsoleAppender implements Appender {
  constructor(private opts: ConsoleAppenderOpts) { }

  append(message: string) {
    (console as any)[this.opts.method](message);
  }
}
