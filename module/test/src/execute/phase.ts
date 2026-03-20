import { Env, TimeUtil } from '@travetto/runtime';

import type { SuiteConfig, SuitePhase } from '../model/suite.ts';
import { Barrier } from './barrier.ts';

const TEST_PHASE_TIMEOUT = TimeUtil.duration(Env.TRV_TEST_PHASE_TIMEOUT.value ?? 15000, 'ms');

/**
 * Test Phase Execution Manager.
 *
 * Handles BeforeAll, BeforeEach, AfterEach, AfterAll
 */
export class TestPhaseManager {
  #progress: ('all' | 'each')[] = [];
  #suite: SuiteConfig;
  #instance: unknown;

  constructor(suite: SuiteConfig, instance: unknown) {
    this.#suite = suite;
    this.#instance = instance;
  }

  /**
   * Run a distinct phase of the test execution
   */
  async runPhase(phase: SuitePhase): Promise<void> {
    let error: Error | undefined;
    for (const handler of this.#suite.phaseHandlers) {
      if (!handler[phase]) {
        continue;
      }

      // Ensure all the criteria below are satisfied before moving forward
      error = await Barrier.awaitOperation(TEST_PHASE_TIMEOUT, async () => handler[phase]?.(this.#instance));

      if (error) {
        throw error;
      }
    }
  }

  /**
   * Start a new phase
   */
  async startPhase(phase: 'all' | 'each'): Promise<void> {
    this.#progress.unshift(phase);
    return this.runPhase(phase === 'all' ? 'beforeAll' : 'beforeEach');
  }

  /**
   * End a phase
   */
  async endPhase(phase: 'all' | 'each'): Promise<void> {
    this.#progress.shift();
    return this.runPhase(phase === 'all' ? 'afterAll' : 'afterEach');
  }

  /**
   * Handle an error during phase operation
   */
  async onError(phase: 'all' | 'each', error: unknown): Promise<Error> {
    if (!(error instanceof Error)) {
      await this.endPhase(phase).catch(() => { });
      throw error;
    }
    return error;
  }
}
