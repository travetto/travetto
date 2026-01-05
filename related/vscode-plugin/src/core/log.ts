import * as vscode from 'vscode';

export class Log {
  static #log: vscode.LogOutputChannel = vscode.window.createOutputChannel('Travetto Plugin', { log: true });
  static #id = `<${`${process.pid}`.slice(-4)}>`;

  #prefix: string;

  constructor(prefix: string) {
    this.#prefix = `[${prefix}]`;
  }

  show(): void {
    Log.#log.show(true);
  }

  info(message: string, ...args: unknown[]): void {
    Log.#log.info(Log.#id, this.#prefix, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    Log.#log.error(Log.#id, this.#prefix, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    Log.#log.debug(Log.#id, this.#prefix, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    Log.#log.warn(Log.#id, this.#prefix, message, ...args);
  }

  trace(message: string, ...args: unknown[]): void {
    Log.#log.trace(Log.#id, this.#prefix, message, ...args);
  }
}