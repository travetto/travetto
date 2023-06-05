import { ExecutionOptions, ExecutionState, ShutdownManager } from '@travetto/base';

import { Workspace } from './workspace';
import { Log } from './log';

const READY_WAIT_WINDOW = 1000 * 15;
const HOUR_WINDOW = 1000 * 60 * 60;

const KILL_WINDOW = 1000 * 60 * 2;
const KILL_WINDOW_PRETTY = '2 minutes';
const MAX_KILL_COUNT = 5;

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer<C extends { type: string }, E extends { type: string }> {

  static getCurrentBucket(): number {
    return Math.trunc((Date.now() % HOUR_WINDOW) / KILL_WINDOW);
  }

  #onStart: (() => (void | Promise<void>))[] = [];
  #onExit: (() => (void | Promise<void>))[] = [];
  #onFail: ((err: Error) => (void | Promise<void>))[] = [];
  #active = true;
  #state: ExecutionState | undefined;
  #command: string;
  #args: string[];
  #opts: ExecutionOptions;
  #killCount: number[] = [];
  #log: Log;

  constructor(log: Log, cliCommand: string, args: string[] = [], opts: ExecutionOptions = {}) {
    this.#command = cliCommand;
    this.#args = args;
    this.#opts = opts;
    this.#log = log;

    const stopper = (): Promise<void> => this.#stop();

    ShutdownManager.onExitRequested(stopper);
    process.on('SIGINT', stopper);
    process.on('exit', stopper);
  }

  async #launchServer(command: string, args: string[], opts: ExecutionOptions = {}): Promise<[ExecutionState, Promise<void>]> {
    const prefix = String.fromCharCode(171);
    const state = Workspace.spawnCli(command, args, {
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      ...opts,
      env: { NO_COLOR: '1', TRV_QUIET: '1', TRV_LOG_TIME: 'false', ...opts.env },
      catchAsResult: true,
      onStdOutLine: line => this.#log.info(prefix, line),
      onStdErrorLine: line => this.#log.error(prefix, line)
    });

    const ready = new Promise<void>((resolve, reject) => {
      setTimeout(reject, READY_WAIT_WINDOW);
      const readyHandler = (msg: unknown): void => {
        if (msg === 'ready') {
          this.#log.info('Service is ready');
          state.process.off('message', readyHandler);
          resolve();
        }
      };
      state.process.on('message', readyHandler);
    }).catch(() => {
      state.process.kill('SIGKILL');
      this.#log.info('Service Timed out');
      throw new Error('Timeout');
    });

    return [state, ready];
  }


  /**
   * Start server, and indicate if this is continuing from a previous failure
   * @param fromExit
   * @returns
   */
  async #start(fromExit?: boolean): Promise<void> {
    if (this.#state) {
      this.#log.info('Already started');
      return;
    } else if (!this.#active) {
      this.#log.info('Server should not be respawned, skipping');
      return;
    }
    const key = ProcessServer.getCurrentBucket();
    if ((this.#killCount[key] ?? 0) >= MAX_KILL_COUNT) {
      this.#active = false;
      const msg = `Exited ${MAX_KILL_COUNT} times in ${KILL_WINDOW_PRETTY}, will not retry`;
      this.#log.error(msg);
      const err = new Error(msg);
      for (const fn of this.#onFail) {
        await fn(err);
      }
      return; // Give up
    } else if (fromExit) {
      this.#killCount[key] = (this.#killCount[key] ?? 0) + 1;
    }

    this.#log.info('Starting', this.#command, ...this.#args);

    const [state, ready] = await this.#launchServer(this.#command, this.#args, this.#opts);
    this.#state = state;

    this.#log.info('Started', this.#state.process.pid);

    ready.then(async () => {
      this.#log.info('Ready', this.#state!.process.pid);
      for (const fn of this.#onStart) {
        await fn();
      }
    });

    const kill = (): void => { this.#state?.process.kill('SIGKILL'); };
    process.on('exit', kill);

    this.#state.process.on('exit', async () => {
      for (const fn of this.#onExit) {
        await fn();
      }
      this.#log.info('Exited', this.#state?.process.pid);
      process.removeListener('exit', kill);
      this.#state = undefined;
    });

    this.#state.result.then(result => {
      this.#log.info('Killed', this.#state?.process.pid, { respawn: this.#active, exitCode: result.code, valid: result.valid });
      this.#active && this.#start(true);
    });

    return ready;
  }

  /**
   * Stop server, and prevent respawn
   */
  async #stop(): Promise<void> {
    if (this.#state) {
      this.#log.info('Stopping');
      const proc = this.#state.process;
      this.#state = undefined;
      const waitForKill = new Promise<void>(res => proc.on('exit', res));
      proc.kill('SIGKILL');
      await waitForKill;
    }
  }

  get running(): boolean {
    return this.#state !== undefined && !this.#state.process.killed;
  }

  /**
   * Listen for when the application starts properly
   */
  onStart(handler: () => void): this {
    this.#onStart.push(handler);
    return this;
  }

  /**
   * Listen for when the application exits
   */
  onExit(handler: () => void): this {
    this.#onExit.push(handler);
    return this;
  }

  /**
   * Listen for failures during the process execution
   */
  onFail(handler: (err: Error) => void): this {
    this.#onFail.push(handler);
    return this;
  }

  /**
   * Force start, even from a non-active state
   * @returns
   */
  start(forceActive = false): Promise<void> {
    if (forceActive) {
      this.#killCount = [];
      this.#active = true;
    }
    return this.#start();
  }

  /**
   * Restart server
   */
  async restart(forceActive = false): Promise<void> {
    if (!this.#state) {
      this.start(forceActive);
    } else {
      this.#killCount = []; // Clear out kill count on a forced restart
      await this.#stop();
    }
  }

  /**
   * Force stop, to an inactive state
   * @returns
   */
  stop(forceInactive = false): Promise<void> {
    if (forceInactive) {
      this.#active = false;
    }
    return this.#stop();
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