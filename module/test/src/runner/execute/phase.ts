import { AssertUtil } from '../assert';
import { Consumer } from '../../consumer';
import { SuiteConfig, SuiteResult, Assertion, TestResult, TestConfig } from '../..';

export const BREAKOUT = Symbol('breakout');
export const TIMEOUT = Symbol('timeout');

const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '5000', 10);

export function asyncTimeout(duration: number = DEFAULT_TIMEOUT): [Promise<any>, Function] {
  let id: NodeJS.Timer;
  if (process.env.DEBUGGER) {
    duration = 600000; // 10 minutes
  }
  const prom = new Promise((_, reject) => {
    id = setTimeout(() => reject(TIMEOUT), duration);
    id.unref()
  });
  return [prom, () => clearTimeout(id)];
}

export class PhaseManager {
  private progress: ('all' | 'each')[] = [];

  constructor(private consumer: Consumer, private suite: SuiteConfig, private result: SuiteResult) { }

  async generateSuiteError(methodName: string, error: Error) {
    // tslint:disable:prefer-const
    let { line, file } = AssertUtil.readFilePosition(error, this.suite.file);
    if (line === 1) {
      line = this.suite.lines.start;
    }
    const badAssert: Assertion = {
      line,
      file,
      error,
      className: this.suite.className,
      methodName,
      message: error.message,
      text: methodName,
      operator: 'throws'
    };
    const badTest: TestResult = {
      status: 'fail',
      className: this.suite.className,
      methodName,
      description: methodName,
      lines: { start: line, end: line },
      file,
      error,
      assertions: [badAssert],
      output: {}
    };

    const badTestConfig: TestConfig = {
      class: this.suite.class,
      className: this.suite.className,
      file: this.suite.file,
      lines: badTest.lines,
      methodName: badTest.methodName,
      description: badTest.description,
      skip: false
    };

    this.consumer.onEvent({ type: 'test', phase: 'before', test: badTestConfig });
    this.consumer.onEvent({ type: 'assertion', phase: 'after', assertion: badAssert });
    this.consumer.onEvent({ type: 'test', phase: 'after', test: badTest });

    return badTest;
  }

  async runPhase(phase: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach') {
    try {
      for (const fn of this.suite[phase]) {
        const [timeout, clear] = asyncTimeout();
        await Promise.race([timeout, fn.call(this.suite.instance)]);
        clear();
      }
    } catch (error) {
      if (error === TIMEOUT) {
        error = new Error(`${this.suite.className}: ${phase} timed out`);
      }
      const res = await this.generateSuiteError(`[[${phase}]]`, error);
      this.result.tests.push(res);
      this.result.fail++;
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
      this.result.fail++;
    }
  }
}
