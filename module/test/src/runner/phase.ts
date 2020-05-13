import { EnvUtil } from '@travetto/boot';

import { Consumer } from '../model/consumer';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { AssertUtil } from '../assert/util';
import { TestUtil } from './util';

export const BREAKOUT = Symbol.for('@trv:test/breakout');

const TEST_PHASE_TIMEOUT = EnvUtil.getTime('TRV_TEST_PHASE_TIMEOUT', 15000);

// TODO: Document
export class ExecutionPhaseManager {
  private progress: ('all' | 'each')[] = [];

  constructor(private consumer: Consumer, private suite: SuiteConfig, private result: SuiteResult) { }

  async generateSuiteError(methodName: string, error: Error) {
    const bad = AssertUtil.generateSuiteError(this.suite, methodName, error);

    this.consumer.onEvent({ type: 'test', phase: 'before', test: bad.testConfig });
    this.consumer.onEvent({ type: 'assertion', phase: 'after', assertion: bad.assert });
    this.consumer.onEvent({ type: 'test', phase: 'after', test: bad.testResult });

    return bad.testResult;
  }

  async runPhase(phase: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach') {
    try {
      for (const fn of this.suite[phase]) {
        const [timeout, clear] = TestUtil.asyncTimeout(TEST_PHASE_TIMEOUT);
        await Promise.race([timeout, fn.call(this.suite.instance)]);
        clear();
      }
    } catch (error) {
      if (error === TestUtil.TIMEOUT) {
        error = new Error(`${this.suite.classId}: ${phase} timed out`);
      }
      const res = await this.generateSuiteError(`[[${phase}]]`, error);
      this.result.tests.push(res);
      this.result.failed++;
      throw BREAKOUT;
    }
  }

  async startPhase(phase: 'all' | 'each') {
    this.progress.unshift(phase);
    return this.runPhase(phase === 'all' ? 'beforeAll' : 'beforeEach');
  }

  async endPhase(phase: 'all' | 'each') {
    this.progress.shift();
    return this.runPhase(phase === 'all' ? 'afterAll' : 'afterEach');
  }

  async onError(err: any) {
    for (const ph of this.progress) {
      try {
        await this.runPhase(ph === 'all' ? 'afterAll' : 'afterEach');
      } catch (e) { /* Do nothing */ }
    }

    this.progress = [];

    if (err !== BREAKOUT) {
      const res = await this.generateSuiteError('all', err);
      this.result.tests.push(res);
      this.result.failed++;
    }
  }
}
