import { createWriteStream } from 'fs';

import { ManifestFileUtil, RootIndex } from '@travetto/manifest';
import { ConsoleManager, Env, TimeUtil } from '@travetto/base';
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
      const stdout = createWriteStream(ManifestFileUtil.toolPath(RootIndex, `test-worker.${process.pid}.log`), { flags: 'a' });
      const c = new console.Console({ stdout, inspectOptions: { depth: 4, colors: false } });
      ConsoleManager.set({ onLog: (ev) => c[ev.level](process.pid, ...ev.args) });
    } else {
      ConsoleManager.set({ onLog: () => { } });
    }

    RunnerUtil.registerCleanup('worker');

    // Listen for inbound requests
    this.on('*', ev => this.onCommand(ev));

    // Let parent know the child is ready for handling commands
    this.send(Events.READY);

    await TimeUtil.wait('10m');
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

    console.debug('Running', { file: event.file });

    await new Runner({
      format: 'exec',
      mode: 'single',
      args: [event.file!, event.class!, event.method!],
      concurrency: 1
    }).run();
  }
}