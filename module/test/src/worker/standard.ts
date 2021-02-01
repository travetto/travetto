import { PhaseManager } from '@travetto/base';
import { RunState } from '../execute/types';

/**
 * Standard worker, used for direct runs from the command line
 */
export class StandardWorker {
  /**
   * Runs tests
   */
  static async run(opts: RunState) {
    try {
      const { Runner } = await import('../execute/runner');
      const { RunnerUtil } = await import('../execute/util');

      RunnerUtil.registerCleanup('runner');

      // Init the app
      await PhaseManager.run('init', '*', '@trv:registry/init');

      // Run the tests
      const res = await new Runner(opts).run();
      return res ? 0 : 1;
    } catch (e) {
      console.error('Test Worker Failed', { error: e });
      return 1;
    }
  }
}