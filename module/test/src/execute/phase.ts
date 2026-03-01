import { describeFunction, Env, TimeUtil } from '@travetto/runtime';

import type { SuiteConfig, SuitePhase } from '../model/suite.ts';
import { AssertUtil } from '../assert/util.ts';
import { Barrier } from './barrier.ts';
import type { TestConfig, TestResult } from '../model/test.ts';

const TEST_PHASE_TIMEOUT = TimeUtil.duration(Env.TRV_TEST_PHASE_TIMEOUT.value ?? 15000, 'ms');

/**
 * Test Phase Execution Manager.
 *
 * Handles BeforeAll, BeforeEach, AfterEach, AfterAll
 */
export class TestPhaseManager {
  #progress: ('all' | 'each')[] = [];
  #suite: SuiteConfig;

  constructor(suite: SuiteConfig) {
    this.#suite = suite;
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
      error = await Barrier.awaitOperation(TEST_PHASE_TIMEOUT, async () => handler[phase]?.(this.#suite.instance));

      if (error) {
        const toThrow = new Error(phase, { cause: error });
        Object.assign(toThrow, { import: describeFunction(handler.constructor) ?? undefined });
        throw toThrow;
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
   * Handles if an error occurs during a phase, ensuring that we attempt to end the phase and then return the appropriate test results for the failure
   */
  async errorPhase(phase: 'all' | 'each', error: unknown, suite: SuiteConfig, test?: TestConfig): Promise<TestResult[]> {
    try { await this.endPhase(phase); } catch { }
    if (!(error instanceof Error)) { throw error; }

    // Don't propagate our own errors
    if (error.message === 'afterAll' || error.message === 'afterEach') {
      return [];
    }

    if (test) {
      return [AssertUtil.generateSuiteTestFailure({ suite, error, test })];
    } else {
      return AssertUtil.generateSuiteTestFailures(suite, error);
    }
  }
}
