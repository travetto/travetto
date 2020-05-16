import * as path from 'path';

import { CatchUnhandled } from '@travetto/base';
import { FsUtil, EnvUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { TestRegistry } from '../registry/registry';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { TestConsumer } from '../model/consumer';
import { AssertCheck } from '../assert/check';
import { AssertCapture } from '../assert/capture';
import { ConsoleCapture } from './console';
import { ExecutionPhaseManager } from './phase';
import { PromiseCapture } from './promise';
import { AssertUtil } from '../assert/util';
import { Timeout } from './timeout';
import { ExecutionError } from './error';

const TEST_TIMEOUT = EnvUtil.getTime('TRV_TEST_TIMEOUT', 5000);

/**
 * Support execution of the tests
 */
export class TestExecutor {

  /**
   * Raw execution, runs the method and then returns any thrown errors as the result.
   * Unexpected errors are thrown (timeout, uncaught, unresolved promises)
   */
  @CatchUnhandled()
  private static async _executeTestMethod(test: TestConfig): Promise<Error | undefined> {
    const suite = TestRegistry.get(test.class);
    const timeout = new Timeout(test.timeout || TEST_TIMEOUT);

    let err: Error | undefined;

    // Run
    try {
      await Promise.race([timeout.wait(), suite.instance[test.methodName]()]);
    } catch (e) {
      err = e;
    }

    // Catch pending promises
    try {
      await Promise.race([timeout.wait(), PromiseCapture.stop()]);
    } catch (e) {
      err = e;
    }

    // Cancel timeout
    timeout.cancel();

    // Errors that are not expected
    if (err && err instanceof ExecutionError) {
      throw err;
    }

    if (test.shouldThrow) {
      err = AssertCheck.checkError(test.shouldThrow!, err)!;
    }

    return err;
  }

  /**
   * Fail an entire file, marking the whole file as failed
   */
  static failFile(consumer: TestConsumer, file: string, err: Error) {
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

  /**
   * An empty suite result based on a suite config
   */
  static createSuiteResult(suite: SuiteConfig) {
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

  /**
   * Execute the test, capture output, assertions and promises
   */
  static async executeTest(consumer: TestConsumer, test: TestConfig) {

    // Mark test start
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
    // Emit every assertion as it occurs
    AssertCapture.start(test, (a) => consumer.onEvent({ type: 'assertion', phase: 'after', assertion: a }));
    PromiseCapture.start(); // Listen for all promises, to detect any unfinished
    ConsoleCapture.start(); // Capture all output from transpiled code

    // Run method and get result
    let error: Error | undefined;
    try {
      error = await this._executeTestMethod(test);
    } catch (badErr) { // If we have a non-assertion error
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

    // Mark completion
    consumer.onEvent({ type: 'test', phase: 'after', test: result as TestResult });

    return result as TestResult;
  }

  /**
   * Execute a single test within a suite
   */
  static async executeSuiteTest(consumer: TestConsumer, suite: SuiteConfig, test: TestConfig) {
    const result: SuiteResult = this.createSuiteResult(suite);

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

  /**
   * Execute an entire suite
   */
  static async executeSuite(consumer: TestConsumer, suite: SuiteConfig) {
    const result: SuiteResult = this.createSuiteResult(suite);

    const startTime = Date.now();

    // Mark suite start
    consumer.onEvent({ phase: 'before', type: 'suite', suite });

    const mgr = new ExecutionPhaseManager(consumer, suite, result);

    try {
      // Handle the BeforeAll calls
      await mgr.startPhase('all');

      for (const testConfig of suite.tests) {
        const testStart = Date.now();
        if (!testConfig.skip) {
          // Handle BeforeEach
          await mgr.startPhase('each');
        }

        // Run test
        const ret = await this.executeTest(consumer, testConfig);
        result[ret.status]++;

        if (!testConfig.skip) {
          result.tests.push(ret);
        }

        // Handle after each
        await mgr.endPhase('each');
        ret.durationTotal = Date.now() - testStart;
      }
      // Handle after all
      await mgr.endPhase('all');
    } catch (e) {
      await mgr.onError(e);
    }

    result.duration = Date.now() - startTime;

    // Mark suite complete
    consumer.onEvent({ phase: 'after', type: 'suite', suite: result });

    result.total = result.passed + result.failed;

    return result as SuiteResult;
  }

  /**
   * Handle executing a suite's test/tests based on command line inputs
   */
  @CatchUnhandled()
  static async execute(consumer: TestConsumer, file: string, ...args: string[]) {

    if (!file.startsWith(FsUtil.cwd)) {
      file = FsUtil.joinUnix(FsUtil.cwd, file);
    }

    try {
      await import(FsUtil.toUnix(file)); // Path to module
    } catch (err) {
      this.failFile(consumer, file, err);
      return;
    }

    // If using a debugger, add a delay for the debugger to connect
    if (EnvUtil.isTrue('TRV_TEST_DEBUGGER')) {
      await new Promise(t => setTimeout(t, 100));
    }

    // Initialize registry (after loading the above)
    await TestRegistry.init();

    // Convert inbound arguments to specific tests to run
    const params = TestRegistry.getRunParams(file, ...args);

    // If running specific suites
    if ('suites' in params) {
      for (const suite of params.suites) {
        if (!suite.skip && suite.tests.length) {
          await this.executeSuite(consumer, suite);
        }
      }
    } else if (params.test) { // If running a single tesst
      await this.executeSuiteTest(consumer, params.suite, params.test);
    } else { // Running the suite
      await this.executeSuite(consumer, params.suite);
    }
  }
}