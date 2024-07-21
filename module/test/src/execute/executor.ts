import { AssertionError } from 'node:assert';
import path from 'node:path';

import { RuntimeIndex } from '@travetto/manifest';
import { Env, TimeUtil, Runtime } from '@travetto/base';
import { Barrier, ExecutionError } from '@travetto/worker';

import { SuiteRegistry } from '../registry/suite';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { TestConsumer } from '../consumer/types';
import { AssertCheck } from '../assert/check';
import { AssertCapture } from '../assert/capture';
import { ConsoleCapture } from './console';
import { TestPhaseManager } from './phase';
import { PromiseCapturer } from './promise';
import { AssertUtil } from '../assert/util';

const TEST_TIMEOUT = TimeUtil.fromValue(Env.TRV_TEST_TIMEOUT.val) ?? 5000;

/**
 * Support execution of the tests
 */
export class TestExecutor {

  /**
   * Raw execution, runs the method and then returns any thrown errors as the result.
   *
   * This method should never throw under any circumstances.
   */
  static async #executeTestMethod(test: TestConfig): Promise<Error | undefined> {
    const suite = SuiteRegistry.get(test.class);

    // Ensure all the criteria below are satisfied before moving forward
    const barrier = new Barrier(test.timeout || TEST_TIMEOUT, true)
      .add(async () => {
        const env = process.env;
        process.env = { ...env }; // Created an isolated environment
        const pCap = new PromiseCapturer();

        try {
          await pCap.run(() =>
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            (suite.instance as Record<string, Function>)[test.methodName]()
          );
        } finally {
          process.env = env; // Restore
        }
      });

    // Wait for all barriers to be satisfied
    return barrier.wait();
  }

  /**
   * Determining if we should skip
   */
  static async #skip(cfg: TestConfig | SuiteConfig, inst: unknown): Promise<boolean | undefined> {
    if (cfg.skip !== undefined) {
      if (typeof cfg.skip === 'boolean' ? cfg.skip : await cfg.skip(inst)) {
        return true;
      }
    }
  }

  /**
   * Fail an entire file, marking the whole file as failed
   */
  static failFile(consumer: TestConsumer, file: string, err: Error): void {
    const name = path.basename(file);
    const classId = RuntimeIndex.getId(file, name);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const suite = { class: { name }, classId, duration: 0, lineStart: 1, lineEnd: 1, file, } as SuiteConfig & SuiteResult;
    err.message = err.message.replaceAll(RuntimeIndex.mainModule.sourcePath, '.');
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
  static createSuiteResult(suite: SuiteConfig): SuiteResult {
    return {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      file: suite.file,
      classId: suite.classId,
      duration: 0,
      tests: []
    };
  }

  /**
   * Execute the test, capture output, assertions and promises
   */
  static async executeTest(consumer: TestConsumer, test: TestConfig, suite: SuiteConfig): Promise<TestResult> {

    // Mark test start
    consumer.onEvent({ type: 'test', phase: 'before', test });

    const startTime = Date.now();

    const result: TestResult = {
      methodName: test.methodName,
      module: Runtime.main.name,
      description: test.description,
      classId: test.classId,
      lineStart: test.lineStart,
      lineEnd: test.lineEnd,
      lineBodyStart: test.lineBodyStart,
      file: test.file,
      status: 'skipped',
      assertions: [],
      duration: 0,
      durationTotal: 0,
      output: {},
    };

    if (await this.#skip(test, suite.instance)) {
      return result;
    }

    // Emit every assertion as it occurs
    const getAssertions = AssertCapture.collector(test, assrt =>
      consumer.onEvent({
        type: 'assertion',
        phase: 'after',
        assertion: assrt
      })
    );

    const consoleCapture = new ConsoleCapture().start(); // Capture all output from transpiled code

    // Run method and get result
    let error = await this.#executeTestMethod(test);

    if (!error) {
      error = AssertCheck.checkError(test.shouldThrow, error); // Rewrite error
    } else {
      if (error instanceof AssertionError) {
        // Pass, do nothing
      } else if (error instanceof ExecutionError) { // Errors that are not expected
        AssertCheck.checkUnhandled(test, error);
      } else if (test.shouldThrow) {
        error = AssertCheck.checkError(test.shouldThrow, error); // Rewrite error
      } else if (error instanceof Error) {
        AssertCheck.checkUnhandled(test, error);
      }
    }

    Object.assign(result, {
      status: error ? 'failed' : 'passed',
      output: consoleCapture.end(),
      assertions: getAssertions(),
      duration: Date.now() - startTime,
      ...(error ? { error } : {})
    });

    // Mark completion
    consumer.onEvent({ type: 'test', phase: 'after', test: result });

    return result;
  }

  /**
   * Execute a single test within a suite
   */
  static async executeSuiteTest(consumer: TestConsumer, suite: SuiteConfig, test: TestConfig): Promise<void> {
    const result: SuiteResult = this.createSuiteResult(suite);

    const mgr = new TestPhaseManager(consumer, suite, result);

    try {
      await mgr.startPhase('all');
      const skip = await this.#skip(test, suite.instance);
      if (!skip) {
        await mgr.startPhase('each');
      }
      await this.executeTest(consumer, test, suite);
      if (!skip) {
        await mgr.endPhase('each');
      }
      await mgr.endPhase('all');
    } catch (err) {
      await mgr.onError(err);
    }
  }

  /**
   * Execute an entire suite
   */
  static async executeSuite(consumer: TestConsumer, suite: SuiteConfig): Promise<SuiteResult> {
    const result: SuiteResult = this.createSuiteResult(suite);

    const startTime = Date.now();

    // Mark suite start
    consumer.onEvent({ phase: 'before', type: 'suite', suite });

    const mgr = new TestPhaseManager(consumer, suite, result);

    const originalEnv = { ...process.env };

    try {
      // Handle the BeforeAll calls
      await mgr.startPhase('all');

      const suiteEnv = { ...process.env };

      for (const test of suite.tests) {
        // Reset env before each test
        process.env = { ...suiteEnv };
        const testStart = Date.now();
        const skip = await this.#skip(test, suite.instance);
        if (!skip) {
          // Handle BeforeEach
          await mgr.startPhase('each');
        }

        // Run test
        const ret = await this.executeTest(consumer, test, suite);
        result[ret.status]++;

        if (!skip) {
          result.tests.push(ret);
        }

        // Handle after each
        await mgr.endPhase('each');
        ret.durationTotal = Date.now() - testStart;
      }
      // Handle after all
      await mgr.endPhase('all');
    } catch (err) {
      await mgr.onError(err);
    }

    // Restore env
    process.env = { ...originalEnv };

    result.duration = Date.now() - startTime;

    // Mark suite complete
    consumer.onEvent({ phase: 'after', type: 'suite', suite: result });

    result.total = result.passed + result.failed;

    return result;
  }

  /**
   * Handle executing a suite's test/tests based on command line inputs
   */
  static async execute(consumer: TestConsumer, file: string, ...args: string[]): Promise<void> {

    file = path.resolve(file);

    const entry = RuntimeIndex.getEntry(file)!;

    try {
      await import(entry.import);
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      this.failFile(consumer, file, err);
      return;
    }

    // Initialize registry (after loading the above)
    await SuiteRegistry.init();

    // Convert inbound arguments to specific tests to run
    const params = SuiteRegistry.getRunParams(file, ...args);

    // If running specific suites
    if ('suites' in params) {
      for (const suite of params.suites) {
        if (!(await this.#skip(suite, suite.instance)) && suite.tests.length) {
          await this.executeSuite(consumer, suite);
        }
      }
    } else if (params.test) { // If running a single test
      await this.executeSuiteTest(consumer, params.suite, params.test);
    } else { // Running the suite
      await this.executeSuite(consumer, params.suite);
    }
  }
}