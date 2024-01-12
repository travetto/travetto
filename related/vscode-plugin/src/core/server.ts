import { spawn } from 'node:child_process';

import { Env, ExecUtil, ExecutionState, ShutdownManager, StreamUtil } from '@travetto/base';
import type { } from '@travetto/log';

import { Log } from './log';
import { RunUtil } from './run';

const READY_WAIT_WINDOW = 1000 * 15;

type Handler<T extends unknown[]> = (...args: T) => (void | Promise<void> | Thenable<unknown>);
type Handlers = {
  start: Handler<[]>[];
  exit: Handler<[]>[];
  fail: Handler<[Error]>[];
};

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer<C extends { type: string }, E extends { type: string }> {

  #handlers: Handlers;
  #state: ExecutionState | undefined;
  #command: string;
  #args: string[];
  #log: Log;

  constructor(log: Log, cliCommand: string, args: string[] = []) {
    this.#command = cliCommand;
    this.#args = args;
    this.#log = log;
    this.#handlers = { start: [], exit: [], fail: [] };

    ShutdownManager.onGracefulShutdown(this.stop.bind(this));
  }

  async #trigger<K extends keyof Handlers>(type: K, ...args: Parameters<Handlers[K][0]>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const fn of this.#handlers[type] as Handler<[]>[]) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      await fn(...args as []);
    }
  }

  async #launchServer(command: string, args: string[]): Promise<[ExecutionState, Promise<void>]> {
    this.#log.info('Starting', command, ...args);

    const proc = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ...RunUtil.buildEnv(),
        ...Env.TRV_DYNAMIC.export(true),
        ...Env.FORCE_COLOR.export(0),
        ...Env.NODE_DISABLE_COLORS.export(true),
        ...Env.NO_COLOR.export(true),
        ...Env.TRV_QUIET.export(true),
        ...Env.TRV_LOG_TIME.export(false),
      },
      shell: false
    });

    const prefix = String.fromCharCode(171);
    StreamUtil.onLine(proc.stdout, line => this.#log.info(prefix, line.trimEnd()));
    StreamUtil.onLine(proc.stderr, line => this.#log.error(prefix, line.trimEnd()));

    const state = {
      result: ExecUtil.getResult(proc, { catch: true }),
      process: proc
    };

    const ready = new Promise<void>((resolve, reject) => {
      setTimeout(reject, READY_WAIT_WINDOW);
      const readyHandler = (msg: unknown): void => {
        if (msg === 'ready') {
          this.#log.info('Service is ready', this.#state!.process.pid);
          state.process.off('message', readyHandler);
          resolve();
        }
      };
      state.process.on('message', readyHandler);
    }).catch(() => {
      ExecUtil.kill(state.process);
      this.#log.info('Service Timed out');
      throw new Error('Timeout');
    });

    ready.then(() => this.#trigger('start'));

    this.#log.info('Started', state.process.pid);

    state.result.then(result => {
      this.#log.info('Exited', this.#state?.process.pid, { exitCode: result.code, valid: result.valid });
      this.stop();
      this.#trigger('exit');
      if (result.code) {
        this.#trigger('fail', new Error(result.message!));
      }
    });

    return [state, ready];
  }

  /**
   * Start server, and indicate if this is continuing from a previous failure
   * @param fromExit
   * @returns
   */
  async start(): Promise<void> {
    if (this.#state) {
      return;
    }
    const [state, ready] = await this.#launchServer(this.#command, this.#args);
    this.#state = state;
    return ready;
  }

  /**
   * Stop server, and prevent respawn
   */
  async stop(): Promise<void> {
    if (this.#state) {
      this.#log.info('Stopping');
      const proc = this.#state.process;
      this.#state = undefined;
      const waitForKill = new Promise<void>(res => proc.on('exit', res));
      ExecUtil.kill(proc);
      await waitForKill;
    }
  }

  get running(): boolean {
    return this.#state !== undefined && !this.#state.process.killed;
  }

  /**
   * Add event listener
   */
  listen<K extends keyof Handlers>(type: K, handler: Handlers[K][0]): this {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#handlers[type].push(handler as Handler<[]>);
    return this;
  }

  /**
   * Restart server
   */
  async restart(): Promise<void> {
    if (this.#state) {
      await this.stop();
    }
    return this.start();
  }

  /**
   * Send message to process
   */
  sendMessage(cmd: C): void {
    if (!this.#state) {
      throw new Error('Server is not running');
    }
    this.#log.info('Sending command', cmd);
    this.#state.process.send(cmd);
  }

  /**
   * Listen for message from process
   */
  onMessage<S extends E['type'], T extends E & { type: S } = E & { type: S }>(types: S | S[], callback: (event: T) => void): () => void {
    if (!this.#state) {
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

  /**
   * Send a message to process, and wait for a response, with the ability to wait for an error state
   */
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