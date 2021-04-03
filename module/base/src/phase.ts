import { SourceIndex } from '@travetto/boot/src/internal/source';
import { ModuleManager } from '@travetto/boot/src/internal/module';

import { OrderingUtil } from './internal/ordering';

interface Initializer {
  action: Function;
  key: string;
}

type Scope = 'init' | 'reset' | 'test';

/**
 * Allows for running application phases.  The manager will
 * scan all the loaded modules for any phase support files
 * to allow for automatic registration of additional functionality.
 *
 * Each support file is structured as:
 * {
 *    key: name,
 *    before?: stages[], // Stage is another files key value
 *    after?: stages[],
 *    init: execution code
 * }
 */
export class PhaseManager {

  /**
   * Create a new Phase manager for a given scope
   * @param scope The scope to run
   * @param upto An optional upper bound on the stages to run, inclusive
   * @param after An optional lower bound on the stages to run, exclusive
   */
  static run(scope: Scope, upto: string = '*', skip: string[] = []) {
    return new PhaseManager(scope).load(upto).then(m => m.run(skip));
  }

  initializers: Initializer[] = [];

  filter: RegExp;

  /**
   * Create a new manager
   * @param scope The scope to run against
   */
  constructor(public scope: Scope) {
    this.filter = new RegExp(`phase[.]${this.scope}(.*?)[.]ts`);
  }

  /**
   * Fetch the associated files in the various support/ folders.
   * @param upto Stopping point, inclusive
   * @param after Starting point, exclusive
   */
  async load(upto?: string, after?: string) {

    const found = ModuleManager.transpileAll(SourceIndex.find({ folder: 'support' }));

    // Load all support files
    const initFiles = await Promise.all(found
      .filter(x => this.filter.test(x.module))
      .map(x => import(x.file)));
    this.initializers = OrderingUtil.compute(initFiles.map(x => x.init));

    if (upto) {
      let end = this.initializers.length - 1;
      let start = 0;

      const endIndex = this.initializers.findIndex(x => x.key === upto);
      if (after) {
        const startIndex = this.initializers.findIndex(x => x.key === after);
        if (startIndex >= 0) {
          start = startIndex + 1;
        }
      }
      if (endIndex >= 0) {
        end = endIndex;
      }
      this.initializers = this.initializers.slice(start, end + 1);
    }

    console.debug('Preparing phase', { scope: this.scope, initializers: this.initializers.map(x => x.key) });

    return this;
  }

  /**
   * Run the phase
   */
  async run(skip: string[] = []) {
    for (const i of this.initializers) {
      if (skip.includes(i.key)) {
        continue;
      }
      const start = Date.now();
      await i.action();
      console.debug('Phase', { scope: this.scope, key: i.key, duration: Date.now() - start });
    }
  }
}