import { OutputHandler } from '../types';

/**
 * Console logging config
 */
export interface ConsoleOutputOpts {
  method: 'log' | 'error';
}

/**
 * Console.output
 */
export class ConsoleOutput implements OutputHandler {
  constructor(private opts: ConsoleOutputOpts) { }

  output(message: string) {
    (console as any)[this.opts.method](message);
  }
}
