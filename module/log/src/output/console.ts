import { OutputHandler } from '../types';

// TODO: Document
export interface ConsoleOutputOpts {
  method: 'log' | 'error';
}

// TODO: Document
export class ConsoleOutput implements OutputHandler {
  constructor(private opts: ConsoleOutputOpts) { }

  output(message: string) {
    (console as any)[this.opts.method](message);
  }
}
