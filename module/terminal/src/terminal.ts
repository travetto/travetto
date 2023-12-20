import tty from 'node:tty';

import { TermState, TermCoord } from './types';
import { TerminalQuerier } from './query';
import { TerminalWriter } from './writer';

/**
 * An enhanced tty write stream
 */
export class Terminal implements TermState {

  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #interactive: boolean;
  #width?: number;
  #query: TerminalQuerier;

  constructor(config: Partial<TermState>) {
    this.#output = config.output ?? process.stdout;
    this.#input = config.input ?? process.stdin;
    this.#interactive = config.interactive ?? (this.#output.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
    this.#width = config.width;
    this.#query = TerminalQuerier.for(this.#input, this.#output);
    process.on('exit', () => this.reset());
  }

  get output(): tty.WriteStream {
    return this.#output;
  }

  get input(): tty.ReadStream {
    return this.#input;
  }

  get interactive(): boolean {
    return this.#interactive;
  }

  get width(): number {
    return this.#width ?? (this.#output.isTTY ? this.#output.columns : 120);
  }

  get height(): number {
    return (this.#output.isTTY ? this.#output.rows : 120);
  }

  writer(): TerminalWriter {
    return TerminalWriter.for(this);
  }

  async writeLines(...text: string[]): Promise<void> {
    return this.writer().writeLines(text, this.interactive).commit();
  }

  reset(): void {
    this.#query.close();
    if (this.interactive) {
      this.#output.write(this.writer().resetCommands());
    }
  }

  getCursorPosition(): Promise<TermCoord> {
    return this.#query.cursorPosition();
  }
}

export const GlobalTerminal = new Terminal({ output: process.stdout });