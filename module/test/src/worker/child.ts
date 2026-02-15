import { createWriteStream } from 'node:fs';

import { JSONUtil, ConsoleManager, Env, Runtime } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { RunUtil } from '../execute/run.ts';
import { TestWorkerEvents } from './types.ts';
import type { TestRun } from '../model/test.ts';

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends IpcChannel<TestRun> {

  #done = Promise.withResolvers<void>();

  async #exec(operation: () => Promise<unknown>, type: string): Promise<void> {
    try {
      await operation();
      this.send(type); // Respond
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      // Mark as errored out
      this.send(type, JSONUtil.cloneForTransmit(error));
    }
  }

  /**
   * Start the worker
   */
  async activate(): Promise<void> {
    if (/\b@travetto[/]test\b/.test(Env.DEBUG.value ?? '')) {
      const file = Runtime.toolPath(`test-worker.${process.pid}.log`);
      const stdout = createWriteStream(file, { flags: 'a' });
      const cons = new console.Console({ stdout, inspectOptions: { depth: 4, colors: false } });
      ConsoleManager.set({ log: (event) => cons[event.level](process.pid, ...event.args) });
    } else {
      ConsoleManager.set({ log: () => { } });
    }

    // Listen for inbound requests
    this.on('*', event => this.onCommand(event));

    // Let parent know the child is ready for handling commands
    this.send(TestWorkerEvents.READY);

    await this.#done.promise;
  }

  /**
   * When we receive a command from the parent
   */
  async onCommand(event: TestRun & { type: string }): Promise<boolean> {
    console.debug('on message', { ...event });

    if (event.type === TestWorkerEvents.INIT) { // On request to init, start initialization
      await this.#exec(() => this.onInitCommand(), TestWorkerEvents.INIT_COMPLETE);
    } else if (event.type === TestWorkerEvents.RUN) { // On request to run, start running
      await this.#exec(() => this.onRunCommand(event), TestWorkerEvents.RUN_COMPLETE);
    }

    return false;
  }

  /**
   * In response to the initialization command
   */
  async onInitCommand(): Promise<void> { }

  /**
   * Run a specific test/suite
   */
  async onRunCommand(run: TestRun): Promise<void> {
    console.debug('Running', { import: run.import });

    try {
      await RunUtil.runTests({ consumer: 'exec' }, run);
    } finally {
      this.#done.resolve();
    }
  }
}