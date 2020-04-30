import type { Compiler } from '@travetto/compiler';
import { FsUtil, EnvUtil } from '@travetto/boot';
import { PhaseManager, Shutdown } from '@travetto/base';
import { CommUtil, ChildCommChannel } from '@travetto/worker';
import { Events, RunEvent } from './types';

const FIXED_MODULES = new Set([
  //  'cache', 'openapi',
  'boot', 'base', 'cli', 'config', 'compiler', 'yaml',
  'worker', 'exec', 'log', 'net', 'jwt', 'image', 'test',
  // 'registry'
]);
const IS_SUPPORT_FILE = /support\/(transformer|phase)[.]/; // TODO: Testing utils need to be externalized to separate folder
const IS_BIN_FILE = '/bin/';
const IS_SELF_FILE = __filename.replace(/.*(test\/.*)([.]ts)?$/, (__, name) => name);

/**
 * Get module name from file, ignore node_modules nested
 * Look at :
 *  - src
 *  - index
 */
const EXTRACT_FILE_MODULE = /^.*travetto[^/]*\/(?:module\/)?([^/]+)\/(?:src\/.*|support\/.*|index[.]ts)$/;

// TODO: Document
export class TestChildWorker extends ChildCommChannel<RunEvent> {

  private compiler: typeof Compiler;
  private runs = 0;

  constructor() {
    super(EnvUtil.getInt('IDLE_TIMEOUT', 120000));

    import('../runner/util').then(({ TestUtil }) => TestUtil.registerCleanup('worker'));
  }

  async activate() {
    // Die if no communication within 120 seconds
    this.listen(async event => {
      console.debug('on message', event);

      if (event.type === Events.INIT) {
        await this.initEvent();
      } else if (event.type === Events.RUN) {
        await this.onRunEvent(event);
      }

      return false;
    });

    this.send(Events.READY);
  }

  async initEvent() {
    console.debug('Init');
    this.compiler = (await import('@travetto/compiler')).Compiler;

    this.send(Events.INIT_COMPLETE);
  }

  isFileResettable(path: string) {
    const k = FsUtil.toUnix(path);
    const frameworkModule = k.replace(EXTRACT_FILE_MODULE, (_, mod) => mod);

    return path.endsWith('.ts') && (!path.endsWith('.d.ts')) && // Only look at .ts files
      (!frameworkModule || // A user file
        (
          !FIXED_MODULES.has(frameworkModule) && // Not a core module
          !IS_SUPPORT_FILE.test(k) && // Not a support file
          !k.includes(IS_BIN_FILE) && // Not a bin file
          !k.includes(IS_SELF_FILE) // Not self
        )
      );
  }

  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', Object.keys(require.cache).length);

    for (const file of Object.keys(require.cache)) {
      if (this.isFileResettable(file)) {
        console.trace(`[${process.pid}]`, 'Unloading', file);
        this.compiler.unload(file);
      }
    }

    // Reload registries, test and root
    console.error('Resetting');
    await PhaseManager.init('reset').run();

    Shutdown.execute(-1);
  }

  async runTest(event: RunEvent) {
    // Run all remaining bootstraps as needed for tests
    await PhaseManager.bootstrap('require-all'); // Require all

    await PhaseManager.bootstrapAfter('registry');

    const { Runner } = await import(`../runner/runner`);

    console.debug('*Running*', event.file);

    await new Runner({
      format: 'exec',
      mode: 'single',
      args: [event.file!, event.class!, event.method!],
      concurrency: 1
    }).run();
  }

  async onRunEvent(event: RunEvent) {
    console.debug('Run');

    try {
      if (this.runs > 0) {
        await this.resetForRun();
      }
      await this.runTest(event);
      this.send(Events.RUN_COMPLETE);
    } catch (e) {
      this.send(Events.RUN_COMPLETE, { error: CommUtil.serializeError(e) });
    }

    this.runs += 1;
  }
}