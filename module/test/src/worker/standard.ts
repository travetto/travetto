import { AppCache } from '@travetto/boot';
import { ScanApp, PhaseManager, Env } from '@travetto/base';
import { State } from '../runner/runner';

export class StandardWorker {
  static async run(opts: State) {
    try {
      // Pre-compile app files, only looking at main src folder
      ScanApp.findActiveAppFiles([Env.cwd],
        // Exclude test
        f => f.includes('@travetto/test'))
        .filter(x => !AppCache.hasEntry(x))
        .map(require);

      const { Runner } = await import('../runner/runner');
      const { TestUtil } = await import('../runner/util');

      TestUtil.registerCleanup('runner');

      await PhaseManager.init('bootstrap', '*', 'registry').run(); // Registry and up

      const res = await new Runner({
        format: opts.format,
        consumer: opts.consumer,
        mode: opts.mode,
        concurrency: opts.concurrency,
        args: opts.args
      }).run();
      return res ? 0 : 1;
    } catch (e) {
      console.error(e?.stack ?? e);
      return 1;
    }
  }
}