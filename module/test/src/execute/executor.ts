import path from 'node:path';

import { Env, TimeUtil, Runtime, castTo, classConstruct, RuntimeIndex, asFull } from '@travetto/runtime';
import { Registry } from '@travetto/registry';

import type { TestConfig, TestResult, TestRun } from '../model/test.ts';
import type { SuiteConfig, SuiteResult } from '../model/suite.ts';
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

  /**
   * Execute the test, capture output, assertions and promises
   */
  async executeTest(test: TestConfig, suite: SuiteConfig, override?: Partial<TestResult>): Promise<TestResult> {

    const result = TestModelUtil.createTestResult(suite, test, override);

    // Mark test start
    this.#consumer.onEvent({ type: 'test', phase: 'before', test });


    // Emit every assertion as it occurs
    const getAssertions = AssertCapture.collector(test, item =>
      this.#consumer.onEvent({
        type: 'assertion',
        phase: 'after',
        assertion: item
      })
    );

    const consoleCapture = new ConsoleCapture().start(); // Capture all output from transpiled code

    // Already finished
    if (result.status === 'errored') {
      if (result.error) {
        AssertCapture.add(AssertUtil.generateAssertion({ suite, test, error: result.error }));
      }
    } else if (result.status !== 'unknown') {
      const startTime = Date.now();
      // Run method and get result
      const error = await this.#executeTestMethod(test);
      const [status, finalError] = AssertCheck.validateTestResultError(test, error);
      result.status = status;
      result.selfDuration = Date.now() - startTime;
      if (finalError) {
        result.error = finalError;
      }
    }

    result.output = consoleCapture.end();
    result.assertions = getAssertions();

    // Mark completion
    this.#consumer.onEvent({ type: 'test', phase: 'after', test: result });

    return result;
  }

  /**
   * Execute an entire suite
   */
  async executeSuite(suite: SuiteConfig, tests: TestConfig[]): Promise<void> {

    suite.instance = classConstruct(suite.class);

    const shouldSkip = await this.#shouldSkip(suite, suite.instance);

    const result: SuiteResult = TestModelUtil.createSuiteResult(suite);

    if (shouldSkip) {
      this.#consumer.onEvent({
        phase: 'after', type: 'suite',
        suite: {
          ...result,
          status: 'skipped',
          skipped: tests.length,
          total: tests.length
        }
      });
    }

    if (shouldSkip || !tests.length) {
      return;
    }

    const validTestMethodNames = new Set(tests.map(t => t.methodName));
    const testConfigs = Object.fromEntries(
      Object.entries(suite.tests).filter(([key]) => validTestMethodNames.has(key))
    );

    // Mark suite start
    this.#consumer.onEvent({ phase: 'before', type: 'suite', suite: { ...suite, tests: testConfigs } });

    const manager = new TestPhaseManager(suite);

    const originalEnv = { ...process.env };

    const startTime = Date.now();
    const testResultOverrides: Record<string, Partial<TestResult>> = {};

    try {
      // Handle the BeforeAll calls
      await manager.startPhase('all');
    } catch (someError) {
      const suiteError = await manager.onError('all', someError);
      for (const method of Object.keys(tests ?? suite.tests)) {
        testResultOverrides[method] ??= { status: 'errored', error: suiteError };
      }
    }

    const suiteEnv = { ...process.env };

    for (const test of tests ?? suite.tests) {
      // Reset env before each test
      process.env = { ...suiteEnv };

      const testStart = Date.now();
      const testResultOverride = (testResultOverrides[test.methodName] ??= {});

      if (await this.#shouldSkip(test, suite.instance)) {
        testResultOverride.status = 'skipped';
      }

      try {
        // Handle BeforeEach
        !testResultOverride.status || await manager.startPhase('each');
      } catch (someError) {
        const testError = await manager.onError('each', someError);
        testResultOverride.error = testError;
        testResultOverride.status = 'errored';
      }

      // Run test
      const testResult = await this.executeTest(test, suite, testResultOverride);

      // Handle after each
      try {
        !testResultOverride.status || await manager.endPhase('each');
      } catch (testError) {
        console.error('Failed to properly shutdown test', testError);
      }

      result.tests[testResult.methodName] = testResult;
      testResult.duration = Date.now() - testStart;
      TestModelUtil.countTestResult(result, [testResult]);
    }

    try {
      // Handle after all
      await manager.endPhase('all');
    } catch (suiteError) {
      console.error('Failed to properly shutdown test', suiteError);
    }

    // Restore env
    process.env = { ...originalEnv };

    result.duration = Date.now() - startTime;
    result.status = TestModelUtil.computeTestStatus(result);

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
      if (!(error instanceof Error)) { throw error; }
      console.error(error);

      const name = path.basename(run.import);
      const classId = `${RuntimeIndex.getFromImport(run.import)?.id}#${name}`;
      const common = { classId, duration: 0, lineStart: 1, lineEnd: 1, import: run.import } as const;
      const suite = asFull<SuiteResult>({
        ...common,
        status: 'errored', errored: 1,
        tests: {
          impport: asFull<TestResult>({
            ...common,
            status: 'errored',
            assertions: [{
              ...common, line: common.lineStart,
              methodName: 'import', operator: 'import', text: `Failed to import ${run.import}`,
            }]
          })
        }
      });
      this.#consumer.onEvent({ type: 'suite', phase: 'after', suite });
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