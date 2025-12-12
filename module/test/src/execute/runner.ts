import path from 'node:path';

import { TimeUtil, Runtime, RuntimeIndex, describeFunction } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { buildStandardTestManager } from '../worker/standard.ts';
import { RunnableTestConsumer } from '../consumer/types/runnable.ts';
import { TestRun } from '../model/test.ts';

import { TestExecutor } from './executor.ts';
import { RunnerUtil } from './util.ts';
import { RunState } from './types.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';

/**
 * Test Runner
 */
export class Runner {

  #state: RunState;

  constructor(state: RunState) {
    this.#state = state;
  }

  async resolveRuns(run: TestRun | string[]): Promise<TestRun[]> {
    if (Array.isArray(run)) {
      const tests = await RunnerUtil.getTestDigest(run, this.#state.tags);
      return RunnerUtil.getTestRuns(tests)
        .toSorted((a, b) => a.runId!.localeCompare(b.runId!));
    } else if ('diffSource' in run) {
      const diff = run.diffSource!;
      const fileToImport = RuntimeIndex.getFromImport(run.import)!.outputFile;
      const imported = await import(fileToImport);
      const classes = Object.fromEntries(
        Object.values(imported).filter(x => typeof x === 'function' && 'Ⲑid' in x)
          .map((cls: Function) => [cls.Ⲑid, describeFunction(cls)])
      );
      const outRuns: TestRun[] = [];

      // TODO: Support inheritance?
      for (const [clsId, config] of Object.entries(diff)) {
        const local = classes[clsId];
        // Class changed
        if (local && local.hash !== config.sourceHash) {
          const diffMethods = Object.entries(config.methods).filter(([_, m]) => local.methods?.[m].hash !== m);
          const methodNames = diffMethods.length ? diffMethods.map(([m]) => m) : undefined;
          outRuns.push({ import: run.import, classId: clsId, methodNames });
        }
      }
      if (outRuns.length === 0) { // Re-run entire file
        outRuns.push({ import: run.import });
      }
      return outRuns;
    } else {
      return [run];
    }
  }

  /**
   * Run multiple tests
   */
  async runMultiple(testRuns: TestRun[]): Promise<boolean> {
    const target = await TestConsumerRegistryIndex.getInstance(this.#state);
    const consumer = new RunnableTestConsumer(target);
    const testCount = testRuns.reduce((acc, cur) => acc + (cur.methodNames ? cur.methodNames.length : 0), 0);

    await consumer.onStart({ testCount });
    await WorkPool.run(
      run => buildStandardTestManager(consumer, run),
      testRuns,
      {
        idleTimeoutMillis: TimeUtil.asMillis(10, 's'),
        min: 1,
        max: this.#state.concurrency
      });

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single test
   */
  async runSingle(run: TestRun): Promise<boolean> {
    run.import =
      RuntimeIndex.getFromImport(run.import)?.import ??
      RuntimeIndex.getFromSource(path.resolve(run.import))?.import!;

    const entry = RuntimeIndex.getFromImport(run.import)!;

    if (entry.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(entry.module);
    }

    const target = await TestConsumerRegistryIndex.getInstance(this.#state);

    const consumer = new RunnableTestConsumer(target)
      .withTransformer(event => {
        // Copy run metadata to event
        event.metadata = run.metadata;
        return event;
      });

    await consumer.onStart({});
    await new TestExecutor(consumer).execute(run);
    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run(run: TestRun | string[]): Promise<boolean | undefined> {
    const runs = await this.resolveRuns(run);

    if (runs.length === 1) {
      return await this.runSingle(runs[0]);
    } else {
      return await this.runMultiple(runs);
    }
  }
}