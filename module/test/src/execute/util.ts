import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import path from 'node:path';

import { Env, ExecUtil, ShutdownManager, Util, RuntimeIndex, Runtime, describeFunction, TimeUtil } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import type { TestConfig, TestRunInput, TestRun, TestGlobInput, TestDiffInput } from '../model/test.ts';
import type { TestRemoveEvent } from '../model/event.ts';
import { TestConsumerShape } from '../consumer/types.ts';
import { RunnableTestConsumer } from '../consumer/types/runnable.ts';
import { TestConsumerConfig } from './types.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { TestExecutor } from './executor.ts';
import { buildStandardTestManager } from '../worker/standard.ts';

/**
 * Test Utilities for Running
 */
export class RunnerUtil {
  /**
   * Add 50 ms to the shutdown to allow for buffers to output properly
   */
  static registerCleanup(scope: string): void {
    ShutdownManager.onGracefulShutdown(() => Util.blockingTimeout(50), `test.${scope}.bufferOutput`);
  }

  /**
   * Determine if a given file path is a valid test file
   */
  static async isTestFile(file: string): Promise<boolean> {
    const reader = readline.createInterface({ input: createReadStream(file) });
    const state = { imp: false, suite: false };
    for await (const line of reader) {
      state.imp ||= line.includes('@travetto/test');
      state.suite ||= line.includes('Suite'); // Decorator or name
      if (state.imp && state.suite) {
        reader.close();
        return true;
      }
    }
    return false;
  }

  /**
   * Find all valid test files given the globs
   */
  static async* getTestImports(globs?: string[]): AsyncIterable<string> {
    const all = RuntimeIndex.find({
      module: mod => mod.roles.includes('test') || mod.roles.includes('std'),
      folder: folder => folder === 'test',
      file: file => file.role === 'test'
    });

    // Collect globs
    if (globs?.length) {
      const allFiles = new Map(all.map(file => [file.sourceFile, file]));
      for await (const item of fs.glob(globs)) {
        const source = Runtime.workspaceRelative(path.resolve(item));
        const match = allFiles.get(source);
        if (match && await this.isTestFile(match.sourceFile)) {
          yield match.import;
        }
      }
    } else {
      for await (const match of all) {
        if (await this.isTestFile(match.sourceFile)) {
          yield match.import;
        }
      }
    }
  }

  /**
   * Get count of tests for a given set of globs
   * @param input
   */
  static async resolveGlobInput({ globs, tags, metadata }: TestGlobInput): Promise<TestRun[]> {
    const countRes = await ExecUtil.getResult(
      spawn('npx', ['trv', 'test:digest', '-o', 'json', ...globs], {
        env: { ...process.env, ...Env.FORCE_COLOR.export(0), ...Env.NO_COLOR.export(true) }
      }),
      { catch: true }
    );
    if (!countRes.valid) {
      throw new Error(countRes.stderr);
    }

    const testFilter = tags?.length ?
      Util.allowDeny<string, [TestConfig]>(
        tags,
        rule => rule,
        (rule, core) => core.tags?.includes(rule) ?? false
      ) :
      ((): boolean => true);

    const parsed: TestConfig[] = countRes.valid ? JSON.parse(countRes.stdout) : [];
    const events = parsed.filter(testFilter).reduce((runs, test) => {
      if (!runs.has(test.classId)) {
        runs.set(test.classId, { import: test.import, classId: test.classId, methodNames: [], runId: Util.uuid(), metadata });
      }
      runs.get(test.classId)!.methodNames!.push(test.methodName);
      return runs;
    }, new Map<string, TestRun>());

    return [...events.values()].sort((a, b) => a.runId!.localeCompare(b.runId!));;
  }

  /**
   * Resolve a test diff source to ensure we are only running changed tests
   */
  static async resolveDiffInput({ import: importPath, diffSource: diff }: TestDiffInput): Promise<{ runs: TestRun[], removes?: TestRemoveEvent[] }> {
    const fileToImport = RuntimeIndex.getFromImport(importPath)!.outputFile;
    const imported = await import(fileToImport);
    const classes = Object.fromEntries(
      Object.values(imported).filter(x => typeof x === 'function' && 'Ⲑid' in x)
        .map((cls: Function) => [cls.Ⲑid, describeFunction(cls)])
    );

    const outRuns: TestRun[] = [];

    // Emit removes when class is removed or method is missing
    for (const [clsId, config] of Object.entries(diff)) {
      const local = classes[clsId];
      // Class changed
      if (local && local.hash !== config.sourceHash) {
        const diffMethods = Object.entries(config.methods).filter(([_, m]) => local.methods?.[m].hash !== m);
        const methodNames = diffMethods.length ? diffMethods.map(([m]) => m) : undefined;
        outRuns.push({ import: importPath, classId: clsId, methodNames });
      }
    }
    if (outRuns.length === 0) { // Re-run entire file
      outRuns.push({ import: importPath });
    }
    return { runs: outRuns };
  }

  /**
   * Reinitialize the manifest if needed, mainly for single test runs
   */
  static async reinitManifestIfNeeded(runs: TestRun[]): Promise<void> {
    if (runs.length === 1) {
      const [run] = runs;
      const entry = RuntimeIndex.getFromImport(run.import)!;

      if (entry.module !== Runtime.main.name) {
        RuntimeIndex.reinitForModule(entry.module);
      }
    }
  }

  /**
   * Build test consumer that wraps a given targeted consumer, and the tests to be run
   */
  static async getRunnableConsumer(target: TestConsumerShape, testRuns: TestRun[]): Promise<RunnableTestConsumer> {
    const byClassId = new Map(testRuns.filter(run => run.classId).map(run => [run.classId, run]));
    const consumer = new RunnableTestConsumer(target)
      .withTransformer((event) => {
        // Copy run metadata to event
        const classId = event.type === 'test' ? event.test.classId : (event.type === 'suite' ? event.suite.classId : undefined);
        const matching = byClassId.get(classId);
        event.metadata = matching?.metadata ?? event.metadata;
        return event;
      });
    const testCount = testRuns.reduce((acc, cur) => acc + (cur.methodNames ? cur.methodNames.length : 0), 0);

    await consumer.onStart({ testCount });
    return consumer;
  }

  /**
   * Run tests
   */
  static async runTests(consumerConfig: TestConsumerConfig, input: TestRunInput): Promise<boolean | undefined> {
    let runs: TestRun[];
    let removes: TestRemoveEvent[] | undefined;
    if ('diffSource' in input) {
      ({ runs, removes } = await this.resolveDiffInput(input));
      console.log(removes);
    } else if ('globs' in input) {
      runs = await this.resolveGlobInput(input);
    } else {
      runs = [input];
    }

    await RunnerUtil.reinitManifestIfNeeded(runs);

    const targetConsumer = await TestConsumerRegistryIndex.getInstance(consumerConfig);
    const consumer = await this.getRunnableConsumer(targetConsumer, runs);

    if (removes) {
      for (const item of removes) {
        consumer.onRemoveEvent(item);
      }
    }

    if (runs.length === 1) {
      await new TestExecutor(consumer).execute(runs[0]);
    } else {
      await WorkPool.run(
        run => buildStandardTestManager(consumer, run),
        runs,
        {
          idleTimeoutMillis: TimeUtil.asMillis(10, 's'),
          min: 1,
          max: consumerConfig.concurrency
        }
      );
    }

    return consumer.summarizeAsBoolean();
  }
}