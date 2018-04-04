import { LocalExecution, ChildExecution, serializeError, deserializeError } from '@travetto/exec';
import * as startup from '@travetto/base/src/startup';
import { Consumer } from '../consumer';

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
  if (!!process.env.DEBUG) {
    console.debug = console.log;
  }
  type Event = { type: string, error?: any, file?: string };

  const worker = new LocalExecution<Event>();

  worker.listen(async (data: Event) => {
    console.log('on message', data);
    if (data.type === Events.INIT) {
      console.debug('Init');

      // Remove all trailing initializers as tests will be on the hook for those manually
      startup.initializers.splice(startup.initializers.findIndex(x => x.priority === 1) + 1, 100);

      // Init Compiler
      Compiler = require('@travetto/compiler').Compiler;
      Compiler.workingSets = ['!'];

      // Initialize
      await startup.run();
      worker.send(Events.INIT_COMPLETE);

    } else if (data.type === Events.RUN) {

      console.debug('Run');

      // Clear require cache of all data loaded minus base framework pieces
      console.debug('Resetting', Object.keys(require.cache).length)
      for (const k of Object.keys(require.cache)) {
        if (/node_modules/.test(k) && !/@travetto/.test(k)) {
          continue;
        }
        if (k.endsWith('.ts') &&
          !/@travetto\/(base|config|compiler|test)/.test(k) &&
          !/transformer\..*\.ts/.test(k)) {
          console.debug('Reset', k)
          delete require.cache[k];
        }
      }

      // Relaod runner
      Compiler.workingSets = [data.file!];
      Compiler.resetFiles();
      const { Runner } = require('./runner');

      try {
        await new Runner().run(data);
        worker.send(Events.RUN_COMPLETE);
      } catch (e) {
        worker.send(Events.RUN_COMPLETE, { error: serializeError(e) });
      }
    }

    return false;
  });

  worker.send(Events.READY);
  setTimeout(_ => { }, Number.MAX_SAFE_INTEGER);
}

export function client<X>(consumer: Consumer, onError?: (err: Error) => any) {
  return {
    create() {
      const worker = new ChildExecution(require.resolve('../../bin/travetto-test.js'), false);
      worker.init();
      (worker as any)['ready'] = worker.listenOnce(Events.READY)
      return worker;
    },
    async init(worker: ChildExecution) {
      await (worker as any)['ready'];
      await worker.send(Events.INIT);
      await worker.listenOnce(Events.INIT_COMPLETE);
      return worker;
    },
    async exec(file: X, exe: ChildExecution) {
      exe.listen(consumer.onEvent as any);
      const complete = exe.listenOnce(Events.RUN_COMPLETE);
      exe.send(Events.RUN, { file });
      const { error } = await complete;

      if (error && onError) {
        onError(deserializeError(error));
      }
    }
  };
}
