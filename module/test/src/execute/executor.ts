import { Env, TimeUtil, Runtime, castTo, classConstruct } from '@travetto/runtime';
import { Registry } from '@travetto/registry';

import type { TestConfig, TestResult, TestRun } from '../model/test.ts';
import type { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite.ts';
import type { TestConsumerShape } from '../consumer/types.ts';
import { AssertCheck } from '../assert/check.ts';
import { AssertCapture } from '../assert/capture.ts';
import { ConsoleCapture } from './console.ts';
import { TestPhaseManager } from './phase.ts';
import { AssertUtil } from '../assert/util.ts';
import { Barrier } from './barrier.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';
import { TestModelUtil } from '../model/util.ts';

const TEST_TIMEOUT = TimeUtil.duration(Env.TRV_TEST_TIMEOUT.value || 5000, 'ms');

/**
 * Support execution of the tests
 */
export class TestExecutor {

  #consumer: TestConsumerShape;

  constructor(consumer: TestConsumerShape) {
    this.#consumer = consumer;
  }

  /**
   * Handles communicating a suite-level error
   * @param failure
   */
  #onSuiteFailure(failure: SuiteFailure): void {
    for (const result of failure.testResults) {
      this.#consumer.onEvent({ type: 'test', phase: 'before', test: failure.suite.tests[result.methodName] });
      for (const assertion of result.assertions) {
        this.#consumer.onEvent({ type: 'assertion', phase: 'after', assertion });
      }
      this.#consumer.onEvent({ type: 'test', phase: 'after', test: result });
    }
  }

  /**
   * Raw execution, runs the method and then returns any thrown errors as the result.
   *
   * This method should never throw under any circumstances.
   */
  async #executeTestMethod(test: TestConfig): Promise<Error | undefined> {
    const suite = SuiteRegistryIndex.getConfig(test.class);

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
  async #shouldSkip(config: TestConfig | SuiteConfig, inst: unknown): Promise<boolean | undefined> {
    if (typeof config.skip === 'function' ? await config.skip(inst) : config.skip) {
      return true;
    }
  }

  #skipTest(test: TestConfig, result: SuiteResult): void {
    // Mark test start
    this.#consumer.onEvent({ type: 'test', phase: 'before', test });
    result.skipped++;
    this.#consumer.onEvent({
      type: 'test',
      phase: 'after',
      test: {
        ...test,
        suiteLineStart: result.lineStart,
        assertions: [], duration: 0, durationTotal: 0, output: [], status: 'skipped'
      }
    });
  }

  /**
   * An empty suite result based on a suite config
   */
  createSuiteResult(suite: SuiteConfig): SuiteResult {
    return {
      passed: 0,
      failed: 0,
      errored: 0,
      skipped: 0,
      unknown: 0,
      total: 0,
      status: 'unknown',
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      import: suite.import,
      classId: suite.classId,
      sourceHash: suite.sourceHash,
      duration: 0,
      tests: {}
    };
  }

  /**
   * Execute the test, capture output, assertions and promises
   */
  async executeTest(test: TestConfig, suite: SuiteConfig): Promise<TestResult> {

    // Mark test start
    this.#consumer.onEvent({ type: 'test', phase: 'before', test });

    const startTime = Date.now();

    const result: TestResult = {
      methodName: test.methodName,
      description: test.description,
      classId: test.classId,
      tags: test.tags,
      suiteLineStart: suite.lineStart,
      lineStart: test.lineStart,
      lineEnd: test.lineEnd,
      lineBodyStart: test.lineBodyStart,
      import: test.import,
      declarationImport: test.declarationImport,
      sourceHash: test.sourceHash,
      status: 'unknown',
      assertions: [],
      duration: 0,
      durationTotal: 0,
      output: [],
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
    const error = await this.#executeTestMethod(test);
    const [status, finalError] = AssertCheck.validateTestResultError(test, error);

    Object.assign(result, {
      status,
      output: consoleCapture.end(),
      assertions: getAssertions(),
      duration: Date.now() - startTime,
      ...(finalError ? { error: finalError } : {})
    });

    // Mark completion
    this.#consumer.onEvent({ type: 'test', phase: 'after', test: result });

    return result;
  }

  /**
   * Execute an entire suite
   */
  async executeSuite(suite: SuiteConfig, tests: TestConfig[]): Promise<void> {

    suite.instance = classConstruct(suite.class);

    if (!tests.length || await this.#shouldSkip(suite, suite.instance)) {
      return;
    }

    const result: SuiteResult = this.createSuiteResult(suite);
    const validTestMethodNames = new Set(tests.map(t => t.methodName));
    const testConfigs = Object.fromEntries(
      Object.entries(suite.tests).filter(([key]) => validTestMethodNames.has(key))
    );

    const startTime = Date.now();

    // Mark suite start
    this.#consumer.onEvent({ phase: 'before', type: 'suite', suite: { ...suite, tests: testConfigs } });

    const manager = new TestPhaseManager(suite, result, event => this.#onSuiteFailure(event));

    const originalEnv = { ...process.env };

    try {
      // Handle the BeforeAll calls
      await manager.startPhase('all');

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
        await manager.startPhase('each');

        // Run test
        const testResult = await this.executeTest(test, suite);
        result.tests[testResult.methodName] = testResult;
        result[testResult.status]++;
        result.total += 1;

        // Handle after each
        await manager.endPhase('each');
        testResult.durationTotal = Date.now() - testStart;
      }

      // Handle after all
      await manager.endPhase('all');
    } catch (error) {
      await manager.onError(error);
    }

    // Restore env
    process.env = { ...originalEnv };

    result.duration = Date.now() - startTime;
    result.status = TestModelUtil.countsToTestStatus(result);

    // Mark suite complete
    this.#consumer.onEvent({ phase: 'after', type: 'suite', suite: result });
  }

  /**
   * Handle executing a suite's test/tests based on command line inputs
   */
  async execute(run: TestRun): Promise<void> {
    try {
      await Runtime.importFrom(run.import);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      console.error(error);
      this.#onSuiteFailure(AssertUtil.gernerateImportFailure(run.import, error));
      return;
    }

    // Initialize registry (after loading the above)
    Registry.finalizeForIndex(SuiteRegistryIndex);

    // Convert inbound arguments to specific tests to run
    const suites = SuiteRegistryIndex.getSuiteTests(run);
    if (!suites.length) {
      console.warn('Unable to find suites for ', run);
    }

    for (const { suite, tests } of suites) {
      await this.executeSuite(suite, tests);
    }
  }
}