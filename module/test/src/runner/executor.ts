import * as assert from 'assert';

import { Env } from '@travetto/base';
import { EnvUtil, FsUtil } from '@travetto/boot';

import { TestRegistry } from '../registry/registry';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { Consumer } from '../model/consumer';
import { AssertCheck } from '../assert/check';
import { AssertCapture } from '../assert/capture';
import { ConsoleCapture } from './console';
import { ExecutionPhaseManager } from './phase';
import { PromiseCapture } from './promise';
import { TestUtil } from './util';
import { AssertUtil } from '../assert/util';

export class TestExecutor {

  static failFile(consumer: Consumer, file: string, err: Error) {
    const name = file.split(/\//).pop()!;
    const suite = { class: { name }, className: name, lines: { start: 1, end: 1 }, file, } as any;
    err.message = err.message.replace(Env.cwd, '.');
    const res = AssertUtil.generateSuiteError(suite, 'require', err);
    consumer.onEvent({ type: 'suite', phase: 'before', suite });
    consumer.onEvent({ type: 'test', phase: 'before', test: res.testConfig });
    consumer.onEvent({ type: 'assertion', phase: 'after', assertion: res.assert });
    consumer.onEvent({ type: 'test', phase: 'after', test: res.testResult });
    consumer.onEvent({ type: 'suite', phase: 'after', suite: { ...suite, fail: 1, success: 0, total: 1, skip: 0 } });
  }

  static async executeTest(consumer: Consumer, test: TestConfig) {

    consumer.onEvent({ type: 'test', phase: 'before', test });

    const startTime = Date.now();

    const suite = TestRegistry.get(test.class);
    const result: Partial<TestResult> = {
      methodName: test.methodName,
      description: test.description,
      className: test.className,
      lines: { ...test.lines },
      file: test.file,
      status: 'skip'
    };

    if (test.skip) {
      return result as TestResult;
    }

    const [timeout, clear] = TestUtil.asyncTimeout(test.timeout);

    try {
      ConsoleCapture.start();
      PromiseCapture.start();
      AssertCapture.start(test, (a) =>
        consumer.onEvent({ type: 'assertion', phase: 'after', assertion: a }));

      await Promise.race([suite.instance[test.methodName](), timeout]);

      // Ensure nothing was meant to be caught
      throw undefined; // eslint-disable-line no-throw-literal

    } catch (err) {
      if (err === TestUtil.TIMEOUT) {
        err = new Error('Operation timed out');
      } else if (test.shouldThrow) {
        err = AssertCheck.checkError(test.shouldThrow!, err)!;
      }

      // If error isn't defined, we are good
      if (!err) {
        result.status = 'success';
      } else {
        result.status = 'fail';
        result.error = err;

        if (!(err instanceof assert.AssertionError)) {
          AssertCheck.checkUnhandled(test, err);
        }
      }
    } finally {
      const err = PromiseCapture.stop();
      const finalErr = await (err && Promise.race([err, timeout]).catch(e => e));

      if (result.status !== 'fail' && finalErr) {
        result.status = 'fail';
        result.error = finalErr;
        AssertCheck.checkUnhandled(test, finalErr);
      }
      clear();
      result.output = ConsoleCapture.end();
      result.assertions = AssertCapture.end();
    }

    result.duration = Date.now() - startTime;

    consumer.onEvent({ type: 'test', phase: 'after', test: result as TestResult });

    return result as TestResult;
  }

  static async executeSuiteTest(consumer: Consumer, suite: SuiteConfig, test: TestConfig) {
    const result: SuiteResult = {
      success: 0,
      fail: 0,
      skip: 0,
      total: 0,
      lines: { ...suite.lines },
      file: suite.file,
      className: suite.className,
      duration: 0,
      tests: []
    };

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

    const result: SuiteResult = {
      success: 0,
      fail: 0,
      skip: 0,
      duration: 0,
      total: 0,
      lines: { ...suite.lines },
      file: suite.file,
      className: suite.className,
      tests: []
    };

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

    result.total = result.success + result.fail;

    return result as SuiteResult;
  }

  static async execute(consumer: Consumer, [file, ...args]: string[]) {
    if (!file.startsWith(Env.cwd)) {
      file = FsUtil.joinUnix(Env.cwd, file);
    }

    try {
      require(FsUtil.toUnix(file)); // Path to module
    } catch (err) {
      this.failFile(consumer, file, err);
      return;
    }

    if (EnvUtil.isTrue('DEBUGGER')) {
      await new Promise(t => setTimeout(t, 100));
    }

    await TestRegistry.init();

    const params = TestRegistry.getRunParams(file, args[0], args[1]);

    if ('suites' in params) {
      for (const suite of params.suites) {
        if (suite.tests.length) {
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