import * as assert from 'assert';
import * as path from 'path';

import { CatchUnhandled } from '@travetto/base';
import { FsUtil, EnvUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { TestRegistry } from '../registry/registry';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { Consumer } from '../model/consumer';
import { AssertCheck } from '../assert/check';
import { AssertCapture } from '../assert/capture';
import { ConsoleCapture } from './console';
import { ExecutionPhaseManager } from './phase';
import { PromiseCapture } from './promise';
import { AssertUtil } from '../assert/util';
import { Timeout } from './timeout';

const MISSING_ERROR = '☆';
const TEST_TIMEOUT = EnvUtil.getTime('TRV_TEST_TIMEOUT', 5000);

// TODO: Document
export class TestExecutor {

  static failFile(consumer: Consumer, file: string, err: Error) {
    const name = path.basename(file);
    const classId = SystemUtil.computeModuleClass(file, name);
    const suite = { class: { name }, classId, lines: { start: 1, end: 1 }, file, } as SuiteConfig & SuiteResult;
    err.message = err.message.replace(FsUtil.cwd, '.');
    const res = AssertUtil.generateSuiteError(suite, 'require', err);
    consumer.onEvent({ type: 'suite', phase: 'before', suite });
    consumer.onEvent({ type: 'test', phase: 'before', test: res.testConfig });
    consumer.onEvent({ type: 'assertion', phase: 'after', assertion: res.assert });
    consumer.onEvent({ type: 'test', phase: 'after', test: res.testResult });
    consumer.onEvent({ type: 'suite', phase: 'after', suite: { ...suite, failed: 1, passed: 0, total: 1, skipped: 0 } });
  }

  @CatchUnhandled()
  static async _executeTest(test: TestConfig): Promise<Error | undefined> {
    const suite = TestRegistry.get(test.class);
    const timeout = new Timeout(test.timeout || TEST_TIMEOUT);

    let err: Error | undefined;

    try {
      await Promise.race([timeout.wait(), suite.instance[test.methodName]()]);
    } catch (e) {
      err = e;
    }

    const pending = PromiseCapture.stop();
    if (pending) {
      try {
        await Promise.race([timeout.wait(), pending]);
      } catch (e) {
        err = e;
      }
    }

    // Cancel timeout
    timeout.cancel();

    // Errors that are not expected
    if (err && !(err instanceof assert.AssertionError)) {
      throw err;
    }

    if (test.shouldThrow) {
      err = AssertCheck.checkError(test.shouldThrow!, err)!;
    }

    return err;
  }

  static async executeTest(consumer: Consumer, test: TestConfig) {

    consumer.onEvent({ type: 'test', phase: 'before', test });

    const startTime = Date.now();

    const result: Partial<TestResult> = {
      methodName: test.methodName,
      description: test.description,
      classId: test.classId,
      lines: { ...test.lines },
      file: test.file,
      status: 'skipped'
    };

    if (test.skip) {
      return result as TestResult;
    }

    PromiseCapture.start();
    ConsoleCapture.start();
    AssertCapture.start(test, (a) =>
      consumer.onEvent({ type: 'assertion', phase: 'after', assertion: a }));

    let error: Error | undefined;
    try {
      error = await this._executeTest(test);
    } catch (badErr) {
      error = badErr;
      AssertCheck.checkUnhandled(test, badErr);
    }

    Object.assign(result, {
      status: error ? 'failed' : 'passed',
      output: ConsoleCapture.end(),
      assertions: AssertCapture.end(),
      duration: Date.now() - startTime,
      ...(error ? { error } : {})
    });

    consumer.onEvent({ type: 'test', phase: 'after', test: result as TestResult });

    return result as TestResult;
  }

  static emptySuiteResult(suite: SuiteConfig) {
    return {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      lines: { ...suite.lines },
      file: suite.file,
      classId: suite.classId,
      duration: 0,
      tests: []
    };
  }

  static async executeSuiteTest(consumer: Consumer, suite: SuiteConfig, test: TestConfig) {
    const result: SuiteResult = this.emptySuiteResult(suite);

    const mgr = new ExecutionPhaseManager(consumer, suite, result);

    try {
      await mgr.startPhase('all');
      if (!test.skip) {
        await mgr.startPhase('each');
      }
      await this.executeTest(consumer, test);
      if (!test.skip) {
        await mgr.endPhase('each');
      }
      await mgr.endPhase('all');
    } catch (e) {
      await mgr.onError(e);
    }
  }

  static async executeSuite(consumer: Consumer, suite: SuiteConfig) {
    const result: SuiteResult = this.emptySuiteResult(suite);

    const startTime = Date.now();

    consumer.onEvent({ phase: 'before', type: 'suite', suite });

    const mgr = new ExecutionPhaseManager(consumer, suite, result);

    try {
      await mgr.startPhase('all');

      for (const testConfig of suite.tests) {
        const testStart = Date.now();
        if (!testConfig.skip) {
          await mgr.startPhase('each');
        }

        const ret = await this.executeTest(consumer, testConfig);
        result[ret.status]++;
        if (!testConfig.skip) {
          result.tests.push(ret);
        }

        await mgr.endPhase('each');
        ret.durationTotal = Date.now() - testStart;
      }
      await mgr.endPhase('all');
    } catch (e) {
      await mgr.onError(e);
    }

    result.duration = Date.now() - startTime;

    consumer.onEvent({ phase: 'after', type: 'suite', suite: result });

    result.total = result.passed + result.failed;

    return result as SuiteResult;
  }

  static async execute(consumer: Consumer, [file, ...args]: string[]) {
    if (!file.startsWith(FsUtil.cwd)) {
      file = FsUtil.joinUnix(FsUtil.cwd, file);
    }

    try {
      require(FsUtil.toUnix(file)); // Path to module
    } catch (err) {
      this.failFile(consumer, file, err);
      return;
    }

    if (EnvUtil.isTrue('TRV_TEST_DEBUGGER')) {
      await new Promise(t => setTimeout(t, 100));
    }

    await TestRegistry.init();

    const params = TestRegistry.getRunParams(file, args[0], args[1]);

    if ('suites' in params) {
      for (const suite of params.suites) {
        if (!suite.skip && suite.tests.length) {
          await this.executeSuite(consumer, suite);
        }
      }
    } else {
      if (params.test) {
        await this.executeSuiteTest(consumer, params.suite, params.test);
      } else {
        await this.executeSuite(consumer, params.suite);
      }
    }
  }
}