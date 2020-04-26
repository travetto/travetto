import { PhaseManager } from '@travetto/base';
import { State } from '../runner/types';

export class StandardWorker {
  static async run(opts: State) {
    try {
      const { Runner } = await import('../runner/runner');
      const { TestUtil } = await import('../runner/util');

      TestUtil.registerCleanup('runner');

      await PhaseManager.bootstrapAfter('registry');

      const res = await new Runner(opts).run();
      return res ? 0 : 1;
    } catch (e) {
      console.error(e?.stack ?? e);
      return 1;
    }
  }
}