import tty from 'node:tty';

import { Env } from '@travetto/base';

import { TermState } from './types';
import { ANSICodes } from './codes';

/**
 * An enhanced tty write stream
 */
export class Terminal implements TermState {

  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #interactive: boolean;
  #width?: number;

  constructor(config: Partial<TermState>) {
    this.#output = config.output ?? process.stdout;
    this.#input = config.input ?? process.stdin;
    this.#interactive = config.interactive ?? (this.#output.isTTY && !Env.TRV_QUIET.isTrue);
    this.#width = config.width;
    if (this.#interactive) {
      process.on('exit', () => { this.#output.write(ANSICodes.SOFT_RESET_CODES()); });
    }
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
}

export const GlobalTerminal = new Terminal({ output: process.stdout });