import { createWriteStream } from 'node:fs';

import { ConsoleManager, Env, Util, Runtime } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { RunnerUtil } from '../execute/util.ts';
import { Runner } from '../execute/runner.ts';
import { Events } from './types.ts';
import { TestRun } from '../model/test.ts';

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends IpcChannel<TestRun> {

  #done = Util.resolvablePromise();

  async #exec(op: () => Promise<unknown>, type: string): Promise<void> {
    try {
      await op();
      this.send(type); // Respond
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      // Mark as errored out
      this.send(type, JSON.parse(Util.serializeToJSON({ error: err })));
    }
  }

  /**
   * Start the worker
   */
  async activate(): Promise<void> {
    if (/\b@travetto[/]test\b/.test(Env.DEBUG.val ?? '')) {
      const file = Runtime.toolPath(`test-worker.${process.pid}.log`);
      const stdout = createWriteStream(file, { flags: 'a' });
      const c = new console.Console({ stdout, inspectOptions: { depth: 4, colors: false } });
      ConsoleManager.set({ log: (ev) => c[ev.level](process.pid, ...ev.args) });
    } else {
      ConsoleManager.set({ log: () => { } });
    }

    RunnerUtil.registerCleanup('worker');

    // Listen for inbound requests
    this.on('*', ev => this.onCommand(ev));

    // Let parent know the child is ready for handling commands
    this.send(Events.READY);

    await this.#done.promise;
  }

  /**
   * When we receive a command from the parent
   */
  async onCommand(event: TestRun & { type: string }): Promise<boolean> {
    console.debug('on message', { ...event });

    if (event.type === Events.INIT) { // On request to init, start initialization
      await this.#exec(() => this.onInitCommand(), Events.INIT_COMPLETE);
    } else if (event.type === Events.RUN) { // On request to run, start running
      await this.#exec(() => this.onRunCommand(event), Events.RUN_COMPLETE);
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
      await new Runner({ consumer: 'exec', target: run }).run();
    } finally {
      this.#done.resolve();
    }
  }
}