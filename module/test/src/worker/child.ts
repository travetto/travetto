import { createWriteStream } from 'node:fs';

import { ConsoleManager, Env, Util, Runtime } from '@travetto/runtime';
import { ChildCommChannel } from '@travetto/worker';

import { ErrorUtil } from '../consumer/error';
import { RunnerUtil } from '../execute/util';
import { Runner } from '../execute/runner';
import { Events, RunEvent } from './types';

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends ChildCommChannel<RunEvent> {

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
      this.send(type, { error: ErrorUtil.serializeError(err) });
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
  async onCommand(event: RunEvent & { type: string }): Promise<boolean> {
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
  async onRunCommand(event: RunEvent): Promise<void> {
    console.debug('Run');

    console.debug('Running', { import: event.import });

    try {
      await new Runner({
        format: 'exec',
        mode: 'single',
        args: [event.import, event.class!, event.method!],
        concurrency: 1
      }).run();
    } finally {
      this.#done.resolve();
    }
  }
}