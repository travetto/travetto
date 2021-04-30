import { ModuleManager } from '@travetto/boot/src/internal/module';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { PhaseManager, ShutdownManager } from '@travetto/base';
import { ChildCommChannel } from '@travetto/worker';

import { Events, RunEvent } from './types';

const FIXED_MODULES = new Set([
  //  'cache', 'openapi',
  // 'registry'
  'boot', 'base', 'cli',
  'compiler', 'transformer',
  'config', 'yaml',
  'worker', 'command',
  'log', 'jwt', 'image',
  'test',
].map(x => `@travetto/${x}` as string));

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends ChildCommChannel<RunEvent> {

  #runs = 0;

  async #exec(op: () => Promise<unknown>, type: string) {
    try {
      await op();
      this.send(type); // Respond
    } catch (e) {
      // Mark as errored out
      this.send(type, { error: ErrorUtil.serializeError(e) });
    }
  }

  /**
   * Start the worker
   */
  async activate() {
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
  async onCommand(event: RunEvent & { type: string }) {
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
  async onInitCommand() { }

  /**
   * Reset the state to prepare for the next run
   */
  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', { fileCount: Object.keys(require.cache).length });

    // Reload registries, test and root
    await PhaseManager.run('reset');
    await ShutdownManager.executeAsync(-1);

    for (const { file } of SourceIndex.find({
      paths: SourceIndex.getPaths().filter(x => !FIXED_MODULES.has(x)),
      includeIndex: true
    })) {
      if (!/support\/(transformer|phase)[.]/.test(file)) {
        const worked = ModuleManager.unload(file);
        if (worked) {
          console.debug('Unloading', { pid: process.pid, file });
        }
      }
    }
  }

  /**
   * Run a specific test/suite
   */
  async onRunCommand(event: RunEvent) {
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