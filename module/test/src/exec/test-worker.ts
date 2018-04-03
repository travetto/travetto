import { LocalWorker, ForkedWorker } from '../worker';
import { serialize, deserialize } from '../worker/error';
import * as startup from '@travetto/base/src/startup';
import { Consumer } from './consumer';

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

  const worker = new LocalWorker<Event>();

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
      worker.send({ type: Events.INIT_COMPLETE });

    } else if (data.type === Events.RUN) {

      console.debug('Run');

      // Clear require cache of all data loaded minus base framework pieces
      console.debug('Resetting', Object.keys(require.cache).length)
      for (const k of Object.keys(require.cache)) {
        if (/node_modules/.test(k) && !/@travetto/.test(k)) {
          continue;
        }
        if (k.endsWith('.ts') &&
          !/@travetto\/(base|config|compiler)/.test(k) &&
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
        await new Runner().runWorker(data);
        worker.send({ type: Events.RUN_COMPLETE });
      } catch (e) {
        worker.send({ type: Events.RUN_COMPLETE, error: serialize(e) });
      }
    }

    return false;
  });

  worker.send({ type: Events.READY });
  setTimeout(_ => { }, Number.MAX_SAFE_INTEGER);
}

export function client<X>(consumers: Consumer[], onError?: (err: Error) => any) {
  return {
    async init() {
      const worker = new ForkedWorker(require.resolve('../../bin/travetto-test.js'));
      await worker.init();
      await worker.listenOnce(Events.READY);
      await worker.send({ type: Events.INIT });
      await worker.listenOnce(Events.INIT_COMPLETE);
      return worker;
    },
    async exec(file: X, worker?: ForkedWorker) {
      if (worker) {
        for (const l of consumers) {
          worker.listen(l.onEvent);
        }
        const complete = worker.listenOnce(Events.RUN_COMPLETE);
        worker.send({ type: Events.RUN, file });
        const { error } = await complete;

        if (error && onError) {
          onError(deserialize(error));
        }
      }
    }
  };
}