import { LocalExecution, ChildExecution, ExecUtil } from '@travetto/exec';
import { ConcurrentPool, IdleManager } from '@travetto/pool';
import { PhaseManager } from '@travetto/base';

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

  let Compiler: any;

  type Event = { type: string, error?: any, file?: string, class?: string, method?: string };

  const worker = new LocalExecution<Event>();

  // Die if no communication within 120 seconds
  const idle = new IdleManager(parseInt(process.env.IDLE_TIMEOUT || '120000', 10));
  idle.extend();

  worker.listen(async (data: Event) => {
    console.debug('on message', data);
    idle.extend(); // Extend

    if (data.type === Events.INIT) {
      console.debug('Init');

      const mgr = new PhaseManager('bootstrap');
      mgr.load(1 /* Load only managed initializers*/);

      // Init Compiler
      Compiler = require('@travetto/compiler').Compiler;
      Compiler.workingSets = ['!'];

      // Initialize
      await mgr.run();
      worker.send(Events.INIT_COMPLETE);

    } else if (data.type === Events.RUN) {

      console.debug('Run');

      // Clear require cache of all data loaded minus base framework pieces
      console.debug('Resetting', Object.keys(require.cache).length);
      for (const k of Object.keys(require.cache)) {
        if (/node_modules/.test(k) && (!/@travetto/.test(k) || /@travetto\/[^/]+\/node_modules/.test(k))) {
          continue;
        }
        if (k.endsWith('.ts') &&
          !/@travetto[\/\\](base|config|compiler|exec|pool)/.test(k) &&
          !(k.startsWith(__filename.replace(/.[tj]s$/, ''))) &&
          !/(phase|transformer)[.]/.test(k)
        ) {
          Compiler.unload(k, false);
        }
      }

      // Reload runner
      Compiler.workingSets = [data.file!];
      Compiler.reset();
      const { Runner } = require('./runner');

      console.debug('*Running*', data.file);

      try {
        await new Runner(['-f', 'exec', '-m', 'single', data.file, data.class, data.method]).run();
        worker.send(Events.RUN_COMPLETE);
      } catch (e) {
        worker.send(Events.RUN_COMPLETE, { error: ExecUtil.serializeError(e) });
      }
    }

    return false;
  });

  worker.send(Events.READY);
  setTimeout(_ => { }, Number.MAX_SAFE_INTEGER / 10000000);
}

export function client() {
  return new ConcurrentPool(async () => {
    const worker = new ChildExecution(require.resolve('../../bin/travetto-test.js'), true);
    worker.init();
    await worker.listenOnce(Events.READY);
    await worker.send(Events.INIT);
    await worker.listenOnce(Events.INIT_COMPLETE);
    return worker;
  }, {
      idleTimeoutMillis: 10000
    });
}