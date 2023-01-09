import { EventEmitter } from 'events';

import { ExecUtil, ExecutionOptions, ExecutionState } from '@travetto/base';
import { Workspace } from './workspace';

type EventType = 'start' | 'stop' | 'pre-start' | 'pre-stop' | 'restart';

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer {

  #emitter = new EventEmitter();
  #respawn = true;
  #state: ExecutionState;
  #path: string;
  #args: string[];
  #opts: ExecutionOptions;

  constructor(path: string, args: string[] = [], opts: ExecutionOptions = {}) {
    this.#path = path;
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

  start(): void {
    if (!this.running) {
      console.log('Starting', { path: this.#path, args: this.#args });
      this.#emit('pre-start');
      this.#state = ExecUtil.spawn(this.#path, this.#args, { ...this.#opts, cwd: Workspace.path });

      this.#state.process.stdout?.pipe(process.stdout);
      this.#state.process.stderr?.pipe(process.stderr);

      this.#state.result.finally(() => {
        if (this.#respawn) {
          this.#emit('restart');
          this.start();
        }
      });

      this.#emit('start');
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
      console.log('Stopping', { path: this.#path, args: this.#args });
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