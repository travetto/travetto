import { OutputHandler } from '../types';

export interface ConsoleOutputOpts {
  method: 'log' | 'error';
}

export class ConsoleOutput implements OutputHandler {
  constructor(private opts: ConsoleOutputOpts) { }

  output(message: string) {
    (console as any).raw[this.opts.method](message);
  }
}
