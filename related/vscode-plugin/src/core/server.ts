import vscode from 'vscode';
import readline from 'readline';
import { EventEmitter } from 'events';

import { ExecutionOptions, ExecutionResult, ExecutionState } from '@travetto/base';
import { Workspace } from './workspace';

type EventType = 'start' | 'stop' | 'pre-start' | 'pre-stop' | 'restart';
type ProcessFailureHandler = (err: Error) => (void | Promise<void>);

const FIVE_MINUTE_WINDOW = 1000 * 60 * 5;
const MAX_KILL_COUNT = 5;

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer {

  #emitter = new EventEmitter();
  #respawn = true;
  #state: ExecutionState;
  #command: string;
  #args: string[];
  #opts: ExecutionOptions;
  #failureHandler?: ProcessFailureHandler;
  #killCount: number[] = [];

  constructor(cliCommand: string, args: string[] = [], opts: ExecutionOptions = {}, onFailure?: ProcessFailureHandler) {
    this.#command = cliCommand;
    this.#args = args;
    this.#opts = opts;
    process.on('SIGINT', this.stop.bind(this));
    process.on('exit', this.stop.bind(this));
  }

  #emit(type: EventType, ...args: unknown[]): void {
    this.#emitter.emit(type, ...args);
  }

  on(type: EventType, handler: (event: unknown) => void): this {
    this.#emitter.on(type, handler);
    return this;
  }

  async #onFailure(result: ExecutionResult) {
    if (this.#respawn && !result.valid) {
      const key = Date.now() % (FIVE_MINUTE_WINDOW);
      this.#killCount[key] += 1;
      if (this.#killCount[key] < MAX_KILL_COUNT) {
        this.#emit('restart');
        this.#start();
      } else if (this.#failureHandler) {
        await this.#failureHandler(new Error(`Failed ${MAX_KILL_COUNT} times in 5 minutes, will not retry`))
        vscode.window.showErrorMessage(`Command ${this.#command} e`);
      }
    }
  }

  #start(): void {
    console.log('Starting', { path: this.#command, args: this.#args });
    this.#emit('pre-start');
    this.#state = Workspace.spawnCli(this.#command, this.#args, { ...this.#opts, catchAsResult: true });

    const prefix = [this.#command, ...this.#args].join(' ');
    if (this.#state.process.stdout) {
      readline.createInterface(this.#state.process.stdout)
        .on('line', line => console.log(prefix, line));
    }
    if (this.#state.process.stderr) {
      readline.createInterface(this.#state.process.stderr)
        .on('line', line => console.error(prefix, line));
    }

    this.#state.result.then(val => this.#onFailure(val));

    this.#emit('start');
  }

  start(): void {
    if (this.running) {
      return;
    } else {
      this.#killCount = []; // Clear out on threshold hit
      this.#start();
    }
  }

  restart(): void {
    if (!this.running) {
      this.start();
    } else {
      this.#state.process.kill('SIGKILL');
      // Will auto respawn
    }
  }

  stop(): void {
    if (this.running) {
      console.log('Stopping', { command: this.#command, args: this.#args });
      this.#respawn = false;
      this.#emit('pre-stop');
      this.#state.process.kill();
      this.#emit('stop');
    }
  }

  get running(): boolean {
    return this.#state && this.#state.process && !this.#state.process.killed;
  }

  sendMessage(type: string, payload: Record<string, unknown> = {}): void {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    this.#state.process.send({ type, ...payload });
  }

  onMessage<U = unknown>(types: string | (string | undefined)[], callback: (type: string, payload: U) => void): () => void {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    types = (Array.isArray(types) ? types : [types]).filter(x => !!x);

    const handler = async (msg: { type: string } & Record<string, unknown>): Promise<void> => {
      if (types.includes(msg.type) || types.includes('*')) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        callback(msg.type, msg as U);

      }
    };
    this.#state.process.on('message', handler);

    return this.#state.process.off.bind(this.#state.process, 'message', handler);
  }

  onceMessage<U = unknown>(types: string | (string | undefined)[], callback: (type: string, payload: U) => void): void {
    const handler = this.onMessage(types, (type: string, payload: U) => {
      handler();
      callback(type, payload);
    });
  }

  sendMessageAndWaitFor<U>(type: string, payload: Record<string, unknown>, waitType: string, errType?: string): Promise<U> {
    const prom = new Promise<U>((resolve, reject) => {
      const remove = this.onMessage([waitType, errType], (resType, msg: U) => {
        remove();
        switch (resType) {
          case waitType: return resolve(msg);
          case errType: return reject(msg);
        }
      });
    });

    this.sendMessage(type, payload);
    return prom;
  }
}