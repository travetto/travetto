import { Env, TimeUtil } from '@travetto/runtime';

import { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite';
import { AssertUtil } from '../assert/util';
import { Barrier } from './barrier';

class TestBreakout extends Error {
  source?: Error;
}

const TEST_PHASE_TIMEOUT = TimeUtil.fromValue(Env.TRV_TEST_PHASE_TIMEOUT.val) ?? 15000;

/**
 * Test Phase Execution Manager.
 *
 * Handles BeforeAll, BeforeEach, AfterEach, AfterAll
 */
export class TestPhaseManager {
  #progress: ('all' | 'each')[] = [];
  #suite: SuiteConfig;
  #result: SuiteResult;
  #onSuiteFailure: (fail: SuiteFailure) => void;

  constructor(suite: SuiteConfig, result: SuiteResult, onSuiteFailure: (fail: SuiteFailure) => void) {
    this.#suite = suite;
    this.#result = result;
    this.#onSuiteFailure = onSuiteFailure;
  }

  /**
   * Run a distinct phase of the test execution
   */
  async runPhase(phase: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach'): Promise<void> {
    let error: Error | undefined;
    for (const fn of this.#suite[phase]) {

      // Ensure all the criteria below are satisfied before moving forward
      error = await Barrier.awaitOperation(TEST_PHASE_TIMEOUT, async () => fn.call(this.#suite.instance));

      if (error) {
        break;
      }
    }
    if (error) {
      const tbo = new TestBreakout(`[[${phase}]]`);
      tbo.source = error;
      throw tbo;
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
   * On error, handle stubbing out error for the phases in progress
   */
  async onError(err: Error | unknown): Promise<void> {
    if (!(err instanceof Error)) {
      throw err;
    }

    for (const ph of this.#progress) {
      try {
        await this.runPhase(ph === 'all' ? 'afterAll' : 'afterEach');
      } catch { /* Do nothing */ }
    }

    this.#progress = [];

    const failure = AssertUtil.generateSuiteFailure(
      this.#suite,
      err instanceof TestBreakout ? err.message : 'all',
      err instanceof TestBreakout ? err.source! : err
    );

    this.#onSuiteFailure(failure);
    this.#result.tests.push(failure.testResult);
    this.#result.failed++;
  }
}
