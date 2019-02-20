import { FileCache, PhaseManager, Env, Shutdown, FsUtil } from '@travetto/base';
import { WorkerClient, WorkerUtil } from '@travetto/worker';
import { Events, TEST_BASE } from './types';

type Event = { type: string, error?: any, file?: string, class?: string, method?: string };

export class TestRunWorker extends WorkerClient<Event> {
  private compiler: any;
  private runs = 0;

  constructor() {
    super(Env.getInt('IDLE_TIMEOUT', 120000));

    Shutdown.onShutdown(`Remove-TempDir`, () => new FileCache(Env.cwd).clear(), true);

    if (Env.isTrue('EXECUTION_REUSABLE')) {
      setTimeout(_ => { }, Number.MAX_SAFE_INTEGER / 10000000);
    }
  }

  async start() {
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
    const isTs = k.endsWith('.ts');
    const isFramework = /travetto(\/module)?\/([^/]+)\/(src|index)/.test(k);
    const isFrameworkCore = isFramework && /travetto(\/module)?\/(base|config|compiler|exec|yaml)\/(src|index)/.test(k);
    const isSupport = /travetto(\/module)?\/([^/]+)\/support\//.test(k);
    const isSelf = k.replace(/[.][tj]s$/, '').endsWith('test/src/runner/communication');

    return !isSelf && !isSupport && isTs && (!isFramework || !isFrameworkCore);
  }

  async resetForRun() {
    // Clear require cache of all data loaded minus base framework pieces
    console.debug('Resetting', Object.keys(require.cache).length);

    for (const file of Object.keys(require.cache)) {
      if (this.isFileResettable(file)) {
        console.debug(`[${process.pid}]`, 'Unloading', file);
        this.compiler.unload(file, false);
      }
    }

    // Reload runner
    this.compiler.reset();
    Shutdown.execute(-1);
  }

  async getRunner() {
    const runnerPath = 'src/runner/runner';

    const { Runner } = await import(FsUtil.resolveUnix(TEST_BASE, runnerPath));

    return Runner;
  }

  async runTest(event: Event) {
    const Runner = await this.getRunner();

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
      this.send(Events.RUN_COMPLETE, { error: WorkerUtil.serializeError(e) });
    }

    this.runs += 1;
  }
}