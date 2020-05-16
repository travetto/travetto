import { EnvUtil } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

import { TestConsumer } from '../model/consumer';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { AssertUtil } from '../assert/util';
import { Timeout } from './timeout';

export const BREAKOUT = Symbol.for('@trv:test/breakout');

const TEST_PHASE_TIMEOUT = EnvUtil.getTime('TRV_TEST_PHASE_TIMEOUT', 15000);

/**
 * Test Phase Execution Manager.
 *
 * Handles BeforeAll, BeforeEach, AfterEach, AfterAll
 */
export class ExecutionPhaseManager {
  private progress: ('all' | 'each')[] = [];

  constructor(private consumer: TestConsumer, private suite: SuiteConfig, private result: SuiteResult) { }

  /**
   * Creeate the appropriate events when a suite has an error
   */
  async triggerSuiteError(methodName: string, error: Error) {
    const bad = AssertUtil.generateSuiteError(this.suite, methodName, error);

    this.consumer.onEvent({ type: 'test', phase: 'before', test: bad.testConfig });
    this.consumer.onEvent({ type: 'assertion', phase: 'after', assertion: bad.assert });
    this.consumer.onEvent({ type: 'test', phase: 'after', test: bad.testResult });

    return bad.testResult;
  }

  /**
   * Run a distinct phase of the test execution
   */
  async runPhase(phase: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach') {
    try {
      for (const fn of this.suite[phase]) {
        const timeout = new Timeout(TEST_PHASE_TIMEOUT, `${this.suite.classId}: ${phase}`);
        try {
          await ShutdownManager.captureUnhandled(() => // Handle earch phase as potentially breaking
            Promise.race([fn.call(this.suite.instance), timeout.wait()]));
        } finally {
          timeout.cancel();
        }
      }
    } catch (error) {
      const res = await this.triggerSuiteError(`[[${phase}]]`, error);
      this.result.tests.push(res);
      this.result.failed++;
      throw BREAKOUT;
    }
  }

  /**
   * Start a new phase
   */
  async startPhase(phase: 'all' | 'each') {
    this.progress.unshift(phase);
    return this.runPhase(phase === 'all' ? 'beforeAll' : 'beforeEach');
  }

  /**
   * End a phase
   */
  async endPhase(phase: 'all' | 'each') {
    this.progress.shift();
    return this.runPhase(phase === 'all' ? 'afterAll' : 'afterEach');
  }

  /**
   * On error, handle stubbing out error for the phases in progress
   */
  async onError(err: any) {
    for (const ph of this.progress) {
      try {
        await this.runPhase(ph === 'all' ? 'afterAll' : 'afterEach');
      } catch (e) { /* Do nothing */ }
    }

    this.progress = [];

    if (err !== BREAKOUT) {
      const res = await this.triggerSuiteError('all', err);
      this.result.tests.push(res);
      this.result.failed++;
    }
  }
}
