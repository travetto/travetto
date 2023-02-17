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
    process.on('SIGINT', () => this.stop());
    process.on('exit', () => this.stop());
  }

  async #launchServer(command: string, args: string[], opts: ExecutionOptions = {}): Promise<[ExecutionState, Promise<void>]> {
    await Workspace.build();

    const state = Workspace.spawnCli(command, args, {
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      ...opts,
      env: { FORCE_COLOR: '0', TRV_QUIET: '1', ...opts.env },
      catchAsResult: true,
      onStdOutLine: line => this.#log.info('stdout', line),
      onStdErrorLine: line => this.#log.error('stderr', line)
    });

    const ready = new Promise<void>((resolve, reject) => {
      setTimeout(reject, READY_WAIT_WINDOW);
      const readyHandler = (msg: unknown): void => {
        if (msg === 'ready') {
          state.process.off('message', readyHandler);
          resolve();
        }
      };
      state.process.on('message', readyHandler);
    }).catch(() => {
      state.process.kill('SIGKILL');
      throw new Error('Timeout');
    });

    return [state, ready];
  }

  /**
   * Listen for when the application starts properly
   */
  onStart(handler: () => void): this {
    this.#onStart.push(handler);
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
   * Start server, and indicate if this is continuing from a previous failure
   * @param fromFailure
   * @returns
   */
  async start(fromFailure?: boolean): Promise<void> {
    if (this.#state) {
      this.#log.info('Already started');
      return;
    } else if (!this.#respawn) {
      this.#log.info('Server should not be respawned, skipping');
      return;
    }
    const key = ProcessServer.getCurrentBucket();
    if ((this.#killCount[key] ?? 0) >= MAX_KILL_COUNT) {
      if (this.#onFail.length) {
        this.#log.error(`Failed ${MAX_KILL_COUNT} times in 2 minutes, will not retry`);
        const err = new Error(`Failed ${MAX_KILL_COUNT} times in 2 minutes, will not retry`);
        for (const fn of this.#onFail) {
          await fn(err);
        }
      }
      return; // Give up
    } else if (fromFailure) {
      this.#killCount[key] = (this.#killCount[key] ?? 0) + 1;
    }

    this.#log.info('Starting', this.#command, ...this.#args);

    const [state, ready] = await this.#launchServer(this.#command, this.#args, this.#opts);
    this.#state = state;

    ready.then(async () => {
      this.#killCount = [];
      for (const fn of this.#onStart) {
        await fn();
      }
    });

    this.#state.process.on('exit', () => this.#state = undefined);

    this.#state.result.then(result => {
      this.#log.info('Killed', { respawn: this.#respawn, exitCode: result.code, valid: result.valid });
      this.#respawn && this.start(!result.valid);
    });

    return ready;
  }

  /**
   * Restart server
   */
  restart(): void {
    if (!this.#state) {
      this.start();
    } else {
      this.#killCount = []; // Clear out kill count on a forced restart
      this.#state.process.kill('SIGKILL'); // Will auto respawn
    }
  }

  /**
   * Stop server, and prevent respawn
   */
  stop(): void {
    if (this.#state) {
      this.#log.info('Stopping');
      this.#respawn = false;
      this.#state.process.kill();
      this.#state = undefined;
    }
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