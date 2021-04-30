import { EventEmitter } from 'events';
import type { ExecutionOptions, ExecutionState } from '@travetto/boot';
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

  #emit(type: EventType, ...args: unknown[]) {
    this.#emitter.emit(type, ...args);
  }

  on(type: EventType, handler: (event: unknown) => void) {
    this.#emitter.on(type, handler);
    return this;
  }

  start() {
    if (!this.running) {
      console.log('Starting', { path: this.#path, args: this.#args });
      this.#emit('pre-start');
      this.#state = Workspace.runMain(this.#path, this.#args, { ...this.#opts, format: 'raw' });

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

  restart() {
    if (!this.running) {
      this.start();
    } else {
      this.#state.process.kill('SIGKILL');
      // Will auto respawn
    }
  }

  stop() {
    if (this.running) {
      console.log('Stopping', { path: this.#path, args: this.#args });
      this.#respawn = false;
      this.#emit('pre-stop');
      this.#state.process.kill();
      this.#emit('stop');
    }
  }

  get running() {
    return this.#state && this.#state.process && !this.#state.process.killed;
  }

  sendMessage(type: string, payload: Record<string, unknown> = {}) {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    this.#state.process.send({ type, ...payload });
  }

  onMessage(types: string | (string | undefined)[], callback: (type: string, payload: Record<string, unknown>) => void) {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    types = (Array.isArray(types) ? types : [types]).filter(x => !!x);

    const handler = async (msg: { type: string } & Record<string, unknown>) => {
      if (types.includes(msg.type) || types.includes('*')) {
        callback(msg.type, msg);

      }
    };
    this.#state.process.on('message', handler);

    return this.#state.process.off.bind(this.#state.process, 'message', handler);
  }

  onceMessage(types: string | (string | undefined)[], callback: (type: string, payload: Record<string, unknown>) => void) {
    const handler = this.onMessage(types, (type: string, payload) => {
      handler();
      callback(type, payload);
    });
  }

  sendMessageAndWaitFor<U>(type: string, payload: Record<string, unknown>, waitType: string, errType?: string): Promise<U> {
    const prom = new Promise<U>((resolve, reject) => {
      const remove = this.onMessage([waitType, errType], (resType, msg) => {
        remove();
        switch (resType) {
          case waitType: return resolve(msg as U);
          case errType: return reject(msg);
        }
      });
    });

    this.sendMessage(type, payload);
    return prom;
  }
}