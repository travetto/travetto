import * as os from 'os';

import { FileCache, PhaseManager, Env, Shutdown, FsUtil } from '@travetto/base';
import { ExecutionPool, IdleManager, LocalExecution, ChildExecution, ExecUtil } from '@travetto/exec';

/***
  Flow of events

  client
    spawns server

  server
    calls 'ready' event

  client
    listens for ready
    triggers init

  server
    listens for init
    initializes workspace for testing
    triggers initComplete

  client
    listens for initComplete
    triggers run with a specific file to run

  server
    listens for run
    Executes tests in specified file
      Communicates results back over process messaging
    triggers runComplete

  client
    Marks tests as done
 */

export const Events = {
  RUN: 'run',
  RUN_COMPLETE: 'runComplete',
  INIT: 'init',
  INIT_COMPLETE: 'initComplete',
  READY: 'ready'
};

export async function server() {

  Shutdown.onShutdown(`Remove-Tempdir`, () => new FileCache(Env.cwd).clear(), true);

  let Compiler: any;

  type Event = { type: string, error?: any, file?: string, class?: string, method?: string };

  const worker = new LocalExecution<Event>();

  // Die if no communication within 120 seconds
  const idle = new IdleManager(Env.getInt('IDLE_TIMEOUT', 120000));
  idle.extend();

  worker.listen(async (data: Event) => {
    console.debug('on message', data);
    idle.extend(); // Extend

    if (data.type === Events.INIT) {
      console.debug('Init');

      const mgr = new PhaseManager('bootstrap');
      mgr.load('compiler');

      // Init Compiler
      Compiler = (await import('@travetto/compiler')).Compiler;

      // Initialize
      await mgr.run();
      worker.send(Events.INIT_COMPLETE);

    } else if (data.type === Events.RUN) {

      console.debug('Run');

      // Clear require cache of all data loaded minus base framework pieces
      console.debug('Resetting', Object.keys(require.cache).length);

      try {
        for (const rk of Object.keys(require.cache)) {
          const k = FsUtil.toUnix(rk);
          const isTs = k.endsWith('.ts');
          const isFramework = /travetto(\/module)?\/([^/]+)\/(src|index)/.test(k);
          const isFrameworkCore = isFramework && /travetto(\/module)?\/(base|config|compiler|exec|yaml)\/(src|index)/.test(k);
          const isSupport = /travetto(\/module)?\/([^/]+)\/support\//.test(k);
          const isSelf = k.replace(/[.][tj]s$/, '').endsWith('test/src/runner/communication');

          if (!isSelf && !isSupport && isTs && (!isFramework || !isFrameworkCore)) {
            console.debug(`[${process.pid}]`, 'Unloading', rk);
            Compiler.unload(rk, false);
          }
        }

        // Reload runner
        Compiler.reset();
        Shutdown.execute(-1);

        let runnerPath = 'src/runner/runner';

        // Handle bad symlink behavior
        if (process.env.TRV_FRAMEWORK_DEV) {
          runnerPath = FsUtil.resolveUnix(process.env.TRV_TEST_BASE!, runnerPath);
        } else {
          runnerPath = FsUtil.resolveUnix('../..', runnerPath);
        }

        const { Runner } = await import(runnerPath);

        console.debug('*Running*', data.file);

        await new Runner({
          format: 'exec',
          mode: 'single',
          args: [data.file!, data.class!, data.method!],
          concurrency: 1
        }).run();
        worker.send(Events.RUN_COMPLETE);
      } catch (e) {
        worker.send(Events.RUN_COMPLETE, { error: ExecUtil.serializeError(e) });
      }
    }

    return false;
  });

  worker.send(Events.READY);

  if (Env.isTrue('EXECUTION_REUSABLE')) {
    setTimeout(_ => { }, Number.MAX_SAFE_INTEGER / 10000000);
  }
}

export function client(concurrency = os.cpus().length - 1) {
  return new ExecutionPool(async () => {
    const worker = new ChildExecution(require.resolve('../../bin/travetto-test-server'), [], true, {
      cwd: Env.cwd,
      env: {
        ...process.env,
        TRV_TEST_BASE: FsUtil.resolveUnix(__dirname, '../..')
      }
    });

    worker.init();
    await worker.listenOnce(Events.READY);
    await worker.send(Events.INIT);
    await worker.listenOnce(Events.INIT_COMPLETE);
    return worker;
  }, {
      idleTimeoutMillis: 10000,
      min: Env.isTrue('EXECUTION_REUSABLE') ? 1 : 0,
      max: concurrency
    });
}