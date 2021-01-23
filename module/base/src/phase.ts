import { SourceIndex, TranspileUtil } from '@travetto/boot';

import { SystemUtil } from './internal/system';

interface Initializer {
  action: Function;
  key: string;
}

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
  static create(scope: string, upto?: string, after?: string) {
    const mgr = new PhaseManager(scope);
    mgr.load(upto, after);
    return mgr;
  }

  /**
   * Shorthand for running the init phase
   * @param upto Optional stopping point
   */
  static init(upto?: string) {
    return this.create('init', upto).run();
  }

  /**
   * Shorthand for running the init phase
   * @param after Optional starting point
   */
  static initAfter(after: string) {
    return this.create('init', '*', after).run();
  }

  initializers: Initializer[] = [];

  filter: RegExp;

  /**
   * Create a new manager
   * @param scope The scope to run against
   */
  constructor(public scope: string) {
    this.filter = new RegExp(`phase[.]${this.scope}(.*?)[.]ts`);
  }

  /**
   * Fetch the associated files in the various support/ folders.
   * @param upto Stopping point, inclusive
   * @param after Starting point, exclusive
   */
  load(upto?: string, after?: string) {
    const found = SourceIndex.find({ folder: 'support', filter: this.filter });

    // Ensure we transpile all files
    for (const el of found) {
      TranspileUtil.transpile(el.file);
    }

    // Load all support files
    const initFiles = found.map(x => require(x.file));
    this.initializers = SystemUtil.computeOrdering(initFiles.map(x => x.init));

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
  async run() {
    for (const i of this.initializers) {
      const start = Date.now();
      await i.action();
      console.debug('Phase', { scope: this.scope, key: i.key, duration: Date.now() - start });
    }
  }
}