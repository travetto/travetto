import { FileCache, PhaseManager, Env, Shutdown, FsUtil } from '@travetto/base';
import { CommUtil, ChildCommChannel } from '@travetto/worker';
import { Events, TEST_BASE } from './types';

type Event = { type: string, error?: any, file?: string, class?: string, method?: string };

const FIXED_MODULES = new Set(['base', 'config', 'compiler', 'exec', 'worker', 'yaml']);
const IS_SUPPORT_FILE = /\/support\//;
const IS_SELF_FILE = /\/test\/src\/worker\//;
const GET_FILE_MODULE = /^.*travetto(?:\/module)?\/([^/]+)\/(?:src\/|index).*$/;

export class TestChildWorker extends ChildCommChannel<Event> {
  static import(rel: string) {
    return import(FsUtil.resolveUnix(TEST_BASE, rel));
  }

  private compiler: any;
  private runs = 0;

  constructor() {
    super(Env.getInt('IDLE_TIMEOUT', 120000));

    TestChildWorker.import('src/runner/util').then(({ TestUtil }) => TestUtil.registerCleanup('worker'));

    if (process.env.TRV_CACHE_DIR === 'PID') {
      Shutdown.onShutdown(`test.worker.clearWorkspace`, () => new FileCache(Env.cwd).clear(), true);
    }

    Shutdown.onShutdown(`test.worker.bufferOutput`,
      () => new Promise(res => setTimeout(res, 100)));

    if (Env.isTrue('EXECUTION_REUSABLE')) {
      setTimeout(_ => { }, Number.MAX_SAFE_INTEGER / 10000000);
    }
  }

  async activate() {
    // Die if no communication within 120 seconds
    this.listen(async (event: Event) => {
      console.debug('on message', event);

      if (event.type === Events.INIT) {
        await this.initEvent();
      } else if (event.type === Events.RUN) {
        await this.runEvent(event);
      }

      return false;
    });

    this.send(Events.READY);
  }

  async initEvent() {
    console.debug('Init');

    const mgr = new PhaseManager('bootstrap');
    mgr.load('compiler');

    // Init compiler
    this.compiler = (await import('@travetto/compiler')).Compiler;

    // Initialize
    await mgr.run();
    this.send(Events.INIT_COMPLETE);
  }

  isFileResettable(path: string) {
    const k = FsUtil.toUnix(path);
    const frameworkModule = k.replace(GET_FILE_MODULE, (_, mod) => mod);

    return !frameworkModule || // A user file
      (
        !FIXED_MODULES.has(frameworkModule) && // Not a core module
        !IS_SUPPORT_FILE.test(k) && // Not a support file
        !IS_SELF_FILE.test(k) // Not self
      );
  }

  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', Object.keys(require.cache).length);

    for (const file of Object.keys(require.cache)) {
      if (file.endsWith('.ts') && this.isFileResettable(file)) {
        console.debug(`[${process.pid}]`, 'Unloading', file);
        this.compiler.unload(file, false);
      }
    }

    // Reload runner
    this.compiler.reset();
    Shutdown.execute(-1);
  }

  async runTest(event: Event) {
    const { Runner } = await TestChildWorker.import('src/runner/runner');

    console.debug('*Running*', event.file);

    await new Runner({
      format: 'exec',
      mode: 'single',
      args: [event.file!, event.class!, event.method!],
      concurrency: 1
    }).run();
  }

  async runEvent(event: Event) {
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