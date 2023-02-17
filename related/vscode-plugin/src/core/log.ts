import vscode from 'vscode';

export class Log {
  static #log: vscode.LogOutputChannel = vscode.window.createOutputChannel('Travetto Plugin', { log: true });

  #prefix: string;

  constructor(prefix: string) {
    this.#prefix = prefix;
  }

  info(message: string, ...args: unknown[]): void {
    Log.#log.info(this.#prefix, message, args);
  }

  error(message: string, ...args: unknown[]): void {
    Log.#log.error(this.#prefix, message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    Log.#log.debug(this.#prefix, message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    Log.#log.warn(this.#prefix, message, args);
  }
}
