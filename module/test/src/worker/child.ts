import type { Compiler } from '@travetto/compiler';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { PhaseManager, ShutdownManager, ScanApp, AppManifest } from '@travetto/base';
import { ChildCommChannel } from '@travetto/worker';
import { Events, RunEvent } from './types';

const FIXED_MODULES = new Set([
  //  'cache', 'openapi',
  'boot', 'base', 'cli', 'config', 'compiler', 'yaml',
  'worker', 'command', 'log', 'net', 'jwt', 'image', 'test',
  // 'registry'
].map(x => `@travetto/${x}`));

/**
 * Child Worker for the Test Runner.  Receives events as commands
 * to run specific tests
 */
export class TestChildWorker extends ChildCommChannel<RunEvent> {

  private compiler: typeof Compiler;
  private runs = 0;

  constructor() {
    super();

    (async () => {
      const { TestUtil } = await import('../runner/util');
      TestUtil.registerCleanup('worker');
    })();
  }

  /**
   * Start the worker
   */
  async activate() {
    // Listen for inbound requests
    this.listen(this.onCommand.bind(this));

    // Let parent know the child is ready for handling commands
    this.send(Events.READY);
  }

  /**
   * When we receive a command from the parent
   */
  async onCommand(event: RunEvent & { type: string }) {
    console.debug('on message', event);

    if (event.type === Events.INIT) { // On request to init, start initialization
      await this.onInitCommand();
      this.send(Events.INIT_COMPLETE); // Respond
    } else if (event.type === Events.RUN) { // On request to run, start running
      try {
        await this.onRunCommand(event); // Run the test
        this.send(Events.RUN_COMPLETE); // Mark complete
      } catch (e) {
        // Mark as errored out
        this.send(Events.RUN_COMPLETE, { error: ErrorUtil.serializeError(e) });
      }
    }

    return false;
  }

  /**
   * In response to the initialization command
   */
  async onInitCommand() {
    // Load the compiler
    this.compiler = (await import('@travetto/compiler')).Compiler;
  }

  /**
   * Reset the state to prepare for the next run
   */
  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', Object.keys(require.cache).length);
    const paths = ScanApp.getPaths(AppManifest.roots).filter(x => !FIXED_MODULES.has(x));
    for (const { file } of ScanApp.findFiles({ paths, includeIndex: true })) {
      if (!/support\/(transformer|phase)[.]/.test(file)) {
        console.debug(`[${process.pid}]`, 'Unloading', file);
        this.compiler.unload(file);
      }
    }

    // Reload registries, test and root
    await PhaseManager.create('reset').run();
    ShutdownManager.execute(-1);
  }

  /**
   * Run a specific test/suite
   */
  async onRunCommand(event: RunEvent) {
    this.runs += 1;
    console.debug('Run');

    if (this.runs > 1) {
      await this.resetForRun();
    }

    // Run all remaining initializations as needed for tests
    await PhaseManager.init('require-all'); // Require all

    await PhaseManager.initAfter('registry');

    const { Runner } = await import(`../runner/runner`);

    console.debug('*Running*', event.file);

    await new Runner({
      format: 'exec',
      mode: 'single',
      args: [event.file!, event.class!, event.method!],
      concurrency: 1
    }).run();
  }
}