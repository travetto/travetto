import { Env, TimeUtil } from '@travetto/runtime';

import type { SuiteConfig, SuiteFailure, SuiteResult, SuitePhase } from '../model/suite.ts';
import { AssertUtil } from '../assert/util.ts';
import { Barrier } from './barrier.ts';

class TestBreakout extends Error {
  source?: Error;
  import?: string;
}

const TEST_PHASE_TIMEOUT = TimeUtil.duration(Env.TRV_TEST_PHASE_TIMEOUT.value ?? 15000, 'ms');

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
  async runPhase(phase: SuitePhase): Promise<void> {
    let error: Error | undefined;
    for (const handler of this.#suite.phaseHandlers.filter(item => item.type === phase)) {

      // Ensure all the criteria below are satisfied before moving forward
      error = await Barrier.awaitOperation(TEST_PHASE_TIMEOUT, async () => handler.action.call(this.#suite.instance));

      if (error) {
        const tbo = new TestBreakout(`[[${phase}]]`);
        tbo.source = error;
        tbo.import = handler.import;
        throw tbo;
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
   * On error, handle stubbing out error for the phases in progress
   */
  async onError(error: Error | unknown): Promise<void> {
    if (!(error instanceof Error)) {
      throw error;
    }

    for (const ph of this.#progress) {
      try {
        await this.runPhase(ph === 'all' ? 'afterAll' : 'afterEach');
      } catch { /* Do nothing */ }
    }

    this.#progress = [];

    const failure = AssertUtil.generateSuiteFailure(
      this.#suite,
      error instanceof TestBreakout ? error.message : 'all',
      error instanceof TestBreakout ? error.source! : error,
      error instanceof TestBreakout ? error.import! : undefined
    );

    this.#onSuiteFailure(failure);
    this.#result.tests[failure.testResult.methodName] = failure.testResult;
    this.#result.failed++;
  }
}
