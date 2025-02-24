import { AssertionError } from 'node:assert';

import { Env, TimeUtil, Runtime, castTo } from '@travetto/runtime';

import { SuiteRegistry } from '../registry/suite.ts';
import { TestConfig, TestResult, TestRun } from '../model/test.ts';
import { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite.ts';
import { TestConsumer } from '../consumer/types.ts';
import { AssertCheck } from '../assert/check.ts';
import { AssertCapture } from '../assert/capture.ts';
import { ConsoleCapture } from './console.ts';
import { TestPhaseManager } from './phase.ts';
import { AssertUtil } from '../assert/util.ts';
import { Barrier } from './barrier.ts';
import { ExecutionError } from './error.ts';

const TEST_TIMEOUT = TimeUtil.fromValue(Env.TRV_TEST_TIMEOUT.val) ?? 5000;

/**
 * Support execution of the tests
 */
export class TestExecutor {

  #consumer: TestConsumer;

  constructor(consumer: TestConsumer) {
    this.#consumer = consumer;
  }

  /**
   * Handles communicating a suite-level error
   * @param failure
   * @param withSuite
   */
  #onSuiteFailure(failure: SuiteFailure, triggerSuite?: boolean): void {
    if (triggerSuite) {
      this.#consumer.onEvent({ type: 'suite', phase: 'before', suite: failure.suite });
    }

    this.#consumer.onEvent({ type: 'test', phase: 'before', test: failure.test });
    this.#consumer.onEvent({ type: 'assertion', phase: 'after', assertion: failure.assert });
    this.#consumer.onEvent({ type: 'test', phase: 'after', test: failure.testResult });

    if (triggerSuite) {
      this.#consumer.onEvent({
        type: 'suite', phase: 'after',
        suite: { ...castTo(failure.suite), failed: 1, passed: 0, total: 1, skipped: 0 }
      });
    }
  }

  /**
   * Raw execution, runs the method and then returns any thrown errors as the result.
   *
   * This method should never throw under any circumstances.
   */
  async #executeTestMethod(test: TestConfig): Promise<Error | undefined> {
    const suite = SuiteRegistry.get(test.class);

    // Ensure all the criteria below are satisfied before moving forward
    return Barrier.awaitOperation(test.timeout || TEST_TIMEOUT, async () => {
      const env = process.env;
      process.env = { ...env }; // Created an isolated environment
      try {
        await castTo<Record<string, Function>>(suite.instance)[test.methodName]();
      } finally {
        process.env = env; // Restore
      }
    });
  }

  /**
   * Determining if we should skip
   */
  async #shouldSkip(cfg: TestConfig | SuiteConfig, inst: unknown): Promise<boolean | undefined> {
    if (typeof cfg.skip === 'function' ? await cfg.skip(inst) : cfg.skip) {
      return true;
    }
  }

  #skipTest(test: TestConfig, result: SuiteResult): void {
    // Mark test start
    this.#consumer.onEvent({ type: 'test', phase: 'before', test });
    result.skipped++;
    this.#consumer.onEvent({ type: 'test', phase: 'after', test: { ...test, assertions: [], duration: 0, durationTotal: 0, output: {}, status: 'skipped' } });
  }

  /**
   * An empty suite result based on a suite config
   */
  createSuiteResult(suite: SuiteConfig): SuiteResult {
    return {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      import: suite.import,
      classId: suite.classId,
      duration: 0,
      tests: []
    };
  }

  /**
   * Execute the test, capture output, assertions and promises
   */
  async executeTest(test: TestConfig): Promise<TestResult> {

    // Mark test start
    this.#consumer.onEvent({ type: 'test', phase: 'before', test });

    const startTime = Date.now();

    const result: TestResult = {
      methodName: test.methodName,
      description: test.description,
      classId: test.classId,
      lineStart: test.lineStart,
      lineEnd: test.lineEnd,
      lineBodyStart: test.lineBodyStart,
      import: test.import,
      sourceImport: test.sourceImport,
      status: 'skipped',
      assertions: [],
      duration: 0,
      durationTotal: 0,
      output: {},
    };

    // Emit every assertion as it occurs
    const getAssertions = AssertCapture.collector(test, asrt =>
      this.#consumer.onEvent({
        type: 'assertion',
        phase: 'after',
        assertion: asrt
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
    this.#consumer.onEvent({ type: 'test', phase: 'after', test: result });

    return result;
  }

  /**
   * Execute an entire suite
   */
  async executeSuite(suite: SuiteConfig, tests: TestConfig[]): Promise<void> {
    if (!tests.length || await this.#shouldSkip(suite, suite.instance)) {
      return;
    }

    const result: SuiteResult = this.createSuiteResult(suite);

    const startTime = Date.now();

    // Mark suite start
    this.#consumer.onEvent({ phase: 'before', type: 'suite', suite });

    const mgr = new TestPhaseManager(suite, result, e => this.#onSuiteFailure(e));

    const originalEnv = { ...process.env };

    try {
      // Handle the BeforeAll calls
      await mgr.startPhase('all');

      const suiteEnv = { ...process.env };

      for (const test of tests ?? suite.tests) {
        if (await this.#shouldSkip(test, suite.instance)) {
          this.#skipTest(test, result);
          continue;
        }

        // Reset env before each test
        process.env = { ...suiteEnv };

        const testStart = Date.now();

        // Handle BeforeEach
        await mgr.startPhase('each');

        // Run test
        const ret = await this.executeTest(test);
        result[ret.status]++;
        result.tests.push(ret);

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
    result.total = result.passed + result.failed;

    // Mark suite complete
    this.#consumer.onEvent({ phase: 'after', type: 'suite', suite: result });
  }

  /**
   * Handle executing a suite's test/tests based on command line inputs
   */
  async execute(run: TestRun): Promise<void> {
    try {
      await Runtime.importFrom(run.import);
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      this.#onSuiteFailure(AssertUtil.gernerateImportFailure(run.import, err));
      return;
    }

    // Initialize registry (after loading the above)
    await SuiteRegistry.init();

    // Convert inbound arguments to specific tests to run
    const suites = SuiteRegistry.getSuiteTests(run);
    if (!suites.length) {
      console.warn('Unable to find suites for ', run);
    }

    for (const { suite, tests } of suites) {
      await this.executeSuite(suite, tests);
    }
  }
}