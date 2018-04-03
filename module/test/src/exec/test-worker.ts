import { ParentWorker } from '../worker';
import { serialize } from '../agent/error';
import * as startup from '@travetto/base/src/startup';

export function run() {

  let Compiler: any;
  if (!!process.env.DEBUG) {
    console.debug = console.log;
  }
  type Event = { type: string, error?: any, file?: string };

  const worker = new ParentWorker<Event>();

  worker.onEvent(async (data: Event) => {
    console.log('on message', data);
    if (data.type === 'init') {
      console.debug('Init');

      // Remove all trailing initializers as tests will be on the hook for those manually
      startup.initializers.splice(startup.initializers.findIndex(x => x.priority === 1) + 1, 100);

      // Init Compiler
      Compiler = require('@travetto/compiler').Compiler;
      Compiler.workingSets = ['!'];

      // Initialize
      await startup.run();
      worker.sendEvent({ type: 'initComplete' });

    } else if (data.type === 'run') {

      console.debug('Run');

      // Clear require cache
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

      Compiler.workingSets = [data.file!];
      Compiler.resetFiles();
      const { Runner } = require('../src/exec/runner');

      try {
        await new Runner().runWorker(data);
        worker.sendEvent({ type: 'runComplete' });
      } catch (e) {
        worker.sendEvent({ type: 'runComplete', error: serialize(e) });
      }
    }

    return false;
  });

  worker.sendEvent({ type: 'ready ' });
  setTimeout(_ => { }, Number.MAX_SAFE_INTEGER);
}