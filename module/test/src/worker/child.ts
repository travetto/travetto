import type { Compiler } from '@travetto/compiler';
import { FsUtil, EnvUtil } from '@travetto/boot';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { PhaseManager, ShutdownManager } from '@travetto/base';
import { ChildCommChannel } from '@travetto/worker';
import { Events, RunEvent } from './types';

const FIXED_MODULES = new Set([
  //  'cache', 'openapi',
  'boot', 'base', 'cli', 'config', 'compiler', 'yaml',
  'worker', 'exec', 'log', 'net', 'jwt', 'image', 'test',
  // 'registry'
]);
const IS_SUPPORT_FILE = /support\/(transformer|phase)[.]/;
const IS_BIN_FILE = '/bin/';
// @ts-ignore
const IS_SELF_FILE = __filename.ᚕunix.replace(/.*(test\/.*)([.][tj]s)?$/, (__, name) => name);

/**
 * Get module name from file, ignore node_modules nested
 * Look at :
 *  - src
 *  - index
 */
const EXTRACT_FILE_MODULE = /^.*travetto[^/]*\/(?:module\/)?([^/]+)\/(?:src\/.*|support\/.*|index[.]ts)$/;

/**
 * Child Worker for the Test Runner.  Recieves events as commands
 * to run specific tests
 */
export class TestChildWorker extends ChildCommChannel<RunEvent> {

  private compiler: typeof Compiler;
  private runs = 0;

  constructor() {
    super(EnvUtil.getTime('TRV_TEST_IDLE_TIMEOUT', 120000));

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
   * Determine if a file is able to be reset from the require cache
   */
  isFileResettable(filePath: string) {
    const frameworkModule = filePath.replace(EXTRACT_FILE_MODULE, (__, mod) => mod);

    return filePath.endsWith('.ts') && (!filePath.endsWith('.d.ts')) && // Only look at .ts files
      (!frameworkModule || // A user file
        (
          !FIXED_MODULES.has(frameworkModule) && // Not a core module
          !IS_SUPPORT_FILE.test(filePath) && // Not a support file
          !filePath.includes(IS_BIN_FILE) && // Not a bin file
          !filePath.includes(IS_SELF_FILE) // Not self
        )
      );
  }

  /**
   * Reset the state to prepare for the next run
   */
  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', Object.keys(require.cache).length);

    for (const file of Object.keys(require.cache).map(FsUtil.toUnix)) {
      if (this.isFileResettable(file)) {
        console.trace(`[${process.pid}]`, 'Unloading', file);
        this.compiler.unload(file);
      }
    }

    // Reload registries, test and root
    await PhaseManager.init('reset').run();
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

    // Run all remaining bootstraps as needed for tests
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