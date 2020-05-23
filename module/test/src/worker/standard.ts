import { PhaseManager } from '@travetto/base';
import { RunState } from '../runner/types';

/**
 * Standard worker, used for direct runs from the command line
 */
export class StandardWorker {
  /**
   * Run stests
   */
  static async run(opts: RunState) {
    try {
      const { Runner } = await import('../runner/runner');
      const { TestUtil } = await import('../runner/util');

      TestUtil.registerCleanup('runner');

      // Bootstrap the app
      await PhaseManager.initAfter('registry');

      // Run the tests
      const res = await new Runner(opts).run();
      return res ? 0 : 1;
    } catch (e) {
      console.error(e);
      return 1;
    }
  }
}