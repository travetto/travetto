import { Host } from '@travetto/boot';
import { ModuleIndex } from '@travetto/boot/src/internal/module';

import { OrderingUtil } from './internal/ordering';

interface PhaseStep {
  action: Function;
  active?: () => (Promise<boolean> | boolean) | boolean;
  key: string;
}

interface PhaseFile {
  step: PhaseStep;
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
  static run(scope: Scope, upto: string = '*', skip: string[] = []): Promise<void> {
    return new PhaseManager(scope).load(upto).then(m => m.run(skip));
  }

  #steps: PhaseStep[] = [];

  #filter: RegExp;

  /**
   * Create a new manager
   * @param scope The scope to run against
   */
  constructor(public scope: Scope) {
    this.#filter = new RegExp(`phase[.]${this.scope}(.*?)[.]`);
  }

  /**
   * Fetch the associated files in the various support/ folders.
   * @param upto Stopping point, inclusive
   * @param after Starting point, exclusive
   */
  async load(upto?: string, after?: string): Promise<this> {

    const found = ModuleIndex.find({ folder: Host.PATH.support, filter: this.#filter });

    // Load all support files
    const files = await Promise.all(found.map(x => import(x.module)));

    // Filter, and validate active
    const modules = (await Promise.all(files
      .filter((x): x is PhaseFile => !!x)
      .map(x => x.step)
      .map(async x => x.active === undefined ? x : (
        typeof x.active === 'boolean' ?
          (x.active ? x : undefined) :
          Promise.resolve(x.active()).then(res => res ? x : undefined)
      ))
    )).filter((x): x is PhaseStep => !!x);

    this.#steps = OrderingUtil.compute(modules);

    if (upto) {
      let end = this.#steps.length - 1;
      let start = 0;

      const endIndex = this.#steps.findIndex(x => x.key === upto);
      if (after) {
        const startIndex = this.#steps.findIndex(x => x.key === after);
        if (startIndex >= 0) {
          start = startIndex + 1;
        }
      }
      if (endIndex >= 0) {
        end = endIndex;
      }
      this.#steps = this.#steps.slice(start, end + 1);
    }

    console.debug('Preparing phase', { scope: this.scope, initializers: this.#steps.map(x => x.key) });

    return this;
  }

  /**
   * Run the phase
   */
  async run(skip: string[] = []): Promise<void> {
    for (const step of this.#steps) {
      if (skip.includes(step.key)) {
        continue;
      }
      const start = Date.now();
      await step.action();
      console.debug('Phase', { scope: this.scope, key: step.key, duration: Date.now() - start });
    }
  }
}