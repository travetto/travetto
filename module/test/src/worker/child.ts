import { TranspileManager } from '@travetto/boot/src/internal/transpile';
import { ModuleIndex } from '@travetto/boot/src/internal/module';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { PhaseManager, ShutdownManager } from '@travetto/base';
import { ChildCommChannel } from '@travetto/worker';

import { Events, RunEvent } from './types';

const FIXED_MODULES = new Set([
  //  'cache', 'openapi',
  // 'registry'
  'boot', 'base', 'cli',
  'compiler', 'transformer',
  'yaml', 'worker', 'command',
  'log', 'jwt', 'image',
  'test',
].map(x => `@travetto/${x}`));

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends ChildCommChannel<RunEvent> {

  #runs = 0;

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
    const { RunnerUtil } = await import('../execute/util');
    RunnerUtil.registerCleanup('worker');

    // Listen for inbound requests
    this.on('*', ev => this.onCommand(ev));

    // Let parent know the child is ready for handling commands
    this.send(Events.READY);
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
   * Reset the state to prepare for the next run
   */
  async resetForRun(): Promise<void> {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', { fileCount: Object.keys(require.cache).length });

    // Reload registries, test and root
    await PhaseManager.run('reset');
    await ShutdownManager.executeAsync(-1);

    for (const { file } of ModuleIndex.find({
      paths: ModuleIndex.getPaths().filter(x => !FIXED_MODULES.has(x)),
      includeIndex: true
    })) {
      if (!/support\/(transformer|phase)[.]/.test(file)) {
        const worked = TranspileManager.unload(file);
        if (worked) {
          console.debug('Unloading', { pid: process.pid, file });
        }
      }
    }
  }

  /**
   * Run a specific test/suite
   */
  async onRunCommand(event: RunEvent): Promise<void> {
    this.#runs += 1;
    console.debug('Run');

    if (this.#runs > 1) {
      await this.resetForRun();
    }

    // Run all remaining initializations as needed for tests
    await PhaseManager.run('init', '*', ['@trv:registry/init']);

    const { Runner } = await import('../execute/runner');

    console.debug('Running', { file: event.file });

    await new Runner({
      format: 'exec',
      mode: 'single',
      args: [event.file!, event.class!, event.method!],
      concurrency: 1
    }).run();
  }
}