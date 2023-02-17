import vscode from 'vscode';
import timers from 'timers/promises';

import { ExecutionOptions, ExecutionState } from '@travetto/base';

import { Workspace } from './workspace';
import { Log } from './log';

const READY_WAIT_WINDOW = 1000 * 15;
const TWO_MINUTE_WINDOW = 1000 * 60 * 2;
const HOUR_WINDOW = 1000 * 60 * 60;
const MAX_KILL_COUNT = 5;

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer<C extends { type: string }, E extends { type: string }> {

  static getCurrentBucket(): number {
    return Math.trunc((Date.now() % HOUR_WINDOW) / TWO_MINUTE_WINDOW);
  }

  #onStart: (() => (void | Promise<void>))[] = [];
  #onFail: ((err: Error) => (void | Promise<void>))[] = [];
  #respawn = true;
  #state: ExecutionState;
  #command: string;
  #args: string[];
  #opts: ExecutionOptions;
  #killCount: number[] = [];
  #log: Log;

  constructor(cliCommand: string, args: string[] = [], opts: ExecutionOptions = {}) {
    this.#command = cliCommand;
    this.#args = args;
    this.#opts = opts;
    this.#log = new Log(`ProcessServer ${cliCommand} ${args.join(' ')}`.trim());
    process.on('SIGINT', () => this.stop());
    process.on('exit', () => this.stop());
  }

  async #launchServer(command: string, args: string[], opts: ExecutionOptions = {}): Promise<[ExecutionState, Promise<void>]> {
    await vscode.window.withProgress(
      { title: 'Building workspace', location: vscode.ProgressLocation.Window },
      () => Workspace.spawnCli('build', [], { catchAsResult: true }).result
    );

    const state = Workspace.spawnCli(command, args, {
      outputMode: 'text-stream',
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      ...opts,
      catchAsResult: true,
      onStdOutLine: line => this.#log.info(line),
      onStdErrorLine: line => this.#log.error(line)
    });

    const res = Promise.race([
      timers.setTimeout(READY_WAIT_WINDOW).then(() => {
        state.process.kill('SIGKILL');
        throw new Error('Timeout');
      }),
      new Promise<void>(resolve => {
        const readyHandler = (msg: unknown): void => {
          if (msg === 'ready') {
            resolve();
            state.process.off('message', readyHandler);
          }
        };
        state.process.on('message', readyHandler);
      })
    ]);

    return [state, res];
  }

  onStart(handler: () => void): this {
    this.#onStart.push(handler);
    return this;
  }

  onFail(handler: (err: Error) => void): this {
    this.#onFail.push(handler);
    return this;
  }

  async start(fromFailure?: boolean): Promise<void> {
    if (this.running) {
      return;
    }
    const key = ProcessServer.getCurrentBucket();
    if ((this.#killCount[key] ?? 0) >= MAX_KILL_COUNT) {
      if (this.#onFail.length) {
        const err = new Error(`Failed ${MAX_KILL_COUNT} times in 2 minutes, will not retry`);
        for (const fn of this.#onFail) {
          await fn(err);
        }
      }
      return; // Give up
    } else if (fromFailure) {
      this.#killCount[key] = (this.#killCount[key] ?? 0) + 1;
    }

    this.#log.info('Starting', { path: this.#command, args: this.#args });

    const [state, ready] = await this.#launchServer(this.#command, this.#args, this.#opts);
    this.#state = state;

    ready.then(async () => {
      this.#killCount = [];
      for (const fn of this.#onStart) {
        await fn();
      }
    });

    this.#state.result.then(result => { this.#respawn && this.start(!result.valid); });

    return ready;
  }

  restart(): void {
    if (!this.running) {
      this.start();
    } else {
      this.#killCount = []; // Clear out kill count on a forced restart
      this.#state.process.kill('SIGKILL'); // Will auto respawn
    }
  }

  stop(): void {
    if (this.running) {
      this.#log.info('Stopping', { command: this.#command, args: this.#args });
      this.#respawn = false;
      this.#state.process.kill();
    }
  }

  get running(): boolean {
    return this.#state && this.#state.process && !this.#state.process.killed;
  }

  sendMessage(cmd: C): void {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    this.#state.process.send(cmd);
  }

  onMessage<S extends E['type'], T extends E & { type: S } = E & { type: S }>(types: S | S[], callback: (event: T) => void): () => void {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    const typeSet = new Set(Array.isArray(types) ? types : [types]);

    const handler = async (msg: E): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (typeSet.has(msg.type as S)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        callback(msg as unknown as T);
      }
    };
    this.#state.process.on('message', handler);

    return this.#state.process.off.bind(this.#state.process, 'message', handler);
  }

  sendMessageAndWaitFor<S extends E['type'], T extends E & { type: S } = E & { type: S }>(cmd: C, waitType: S, errType?: E['type']): Promise<T> {
    const prom = new Promise<T>((resolve, reject) => {
      const remove = this.onMessage(errType ? [waitType, errType] : [waitType], (msg: E) => {
        remove();
        switch (msg.type) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          case waitType: return resolve(msg as unknown as T);
          case errType: return reject(msg);
        }
      });
    });

    this.sendMessage(cmd);
    return prom;
  }
}