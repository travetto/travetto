import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import path from 'node:path';

import { Env, ExecUtil, Util, RuntimeIndex, Runtime, TimeUtil, JSONUtil } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';
import { Registry } from '@travetto/registry';

import type { TestConfig, TestRunInput, TestRun, TestGlobInput, TestDiffInput } from '../model/test.ts';
import type { TestRemoveEvent } from '../model/event.ts';
import type { TestConsumerShape } from '../consumer/types.ts';
import { RunnableTestConsumer } from '../consumer/types/runnable.ts';
import type { TestConsumerConfig } from './types.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { TestExecutor } from './executor.ts';
import { buildStandardTestManager } from '../worker/standard.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

type RunState = {
  runs: TestRun[];
  removes?: TestRemoveEvent[];
};

/**
 * Test Utilities for Running
 */
export class RunUtil {

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
      module: module => module.roles.includes('test') || module.roles.includes('std'),
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
      for (const match of all) {
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
    const digestProcess = await ExecUtil.getResult(
      ExecUtil.spawnPackageCommand('trv', ['test:digest', '-o', 'json', ...globs], {
        env: { ...process.env, ...Env.FORCE_COLOR.export(0), ...Env.NO_COLOR.export(true) },
      }),
      { catch: true }
    );

    if (!digestProcess.valid) {
      throw new Error(digestProcess.stderr);
    }

    const testFilter = tags?.length ?
      Util.allowDeny<string, [TestConfig]>(
        tags,
        rule => rule,
        (rule, core) => core.tags?.includes(rule) ?? false
      ) :
      ((): boolean => true);

    const parsed: TestConfig[] = JSONUtil.fromUTF8(digestProcess.stdout);

    const events = parsed.filter(testFilter).reduce((runs, test) => {
      runs.getOrInsert(test.classId,
        { import: test.import, classId: test.classId, methodNames: [], runId: Util.uuid(), metadata }
      ).methodNames!.push(test.methodName);
      return runs;
    }, new Map<string, TestRun>());

    return [...events.values()].sort((a, b) => a.runId!.localeCompare(b.runId!));
  }

  /**
   * Resolve a test diff source to ensure we are only running changed tests
   */
  static async resolveDiffInput({ import: importPath, diffSource: diff, metadata }: TestDiffInput): Promise<RunState> {
    // Runs, defaults to new classes
    const runs: TestRun[] = [];
    const addRun = (clsId: string | undefined, methods?: string[]): void => {
      runs.push({ import: importPath, classId: clsId, methodNames: methods?.length ? methods : undefined, metadata });
    };
    const removes: TestRemoveEvent[] = [];
    const removeTest = (clsId: string, methodName?: string): void => {
      removes.push({ type: 'removeTest', import: importPath, classId: clsId, methodName });
    };

    const imported = await Registry.manualInit([importPath]);
    const classes = Object.fromEntries(
      imported
        .filter(cls => SuiteRegistryIndex.hasConfig(cls))
        .map(cls => [cls.Ⲑid, SuiteRegistryIndex.getConfig(cls)])
    );

    // New classes
    for (const clsId of Object.keys(classes)) {
      if (!diff[clsId]) {
        addRun(clsId);
      }
    }

    // Looking at Diff
    for (const [clsId, config] of Object.entries(diff)) {
      const local = classes[clsId];
      if (!local) { // Removed classes
        removeTest(clsId);
      } else if (local.sourceHash !== config.sourceHash) { // Class changed or added
        // Methods to run, defaults to newly added
        const methods: string[] = Object.keys(local.tests ?? {}).filter(key => !config.methods[key]);
        let didRemove = false;
        for (const key of Object.keys(config.methods)) {
          const localMethod = local.tests?.[key];
          if (!localMethod) { // Test is removed
            removeTest(clsId, key);
            didRemove = true;
          } else if (localMethod.sourceHash !== config.methods[key]) { // Method changed or added
            methods.push(key);
          }
        }
        if (!didRemove || methods.length > 0) {
          addRun(clsId, methods);
        }
      }
    }

    if (runs.length === 0 && removes.length === 0) { // Re-run entire file, classes unchanged
      addRun(undefined);
    }

    return { runs, removes };
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
    const consumer = new RunnableTestConsumer(target);
    const testCount = testRuns.reduce((acc, cur) => acc + (cur.methodNames ? cur.methodNames.length : 0), 0);

    await consumer.onStart({ testCount });
    return consumer;
  }

  /**
   * Resolve input into run state
   */
  static async resolveInput(input: TestRunInput): Promise<RunState> {
    if ('diffSource' in input) {
      return await this.resolveDiffInput(input);
    } else if ('globs' in input) {
      return { runs: await this.resolveGlobInput(input) };
    } else {
      return { runs: [input], removes: [] };
    }
  }

  /**
   * Run tests
   */
  static async runTests(consumerConfig: TestConsumerConfig, input: TestRunInput): Promise<boolean | undefined> {
    const { runs, removes } = await this.resolveInput(input);

    const targetConsumer = await TestConsumerRegistryIndex.getInstance(consumerConfig);
    const consumer = await this.getRunnableConsumer(targetConsumer, runs);

    await this.reinitManifestIfNeeded(runs);

    for (const item of removes ?? []) {
      consumer.onRemoveEvent(item);
    }

    if (runs.length === 1) {
      await new TestExecutor(consumer).execute(runs[0]);
    } else {
      await WorkPool.run(
        run => buildStandardTestManager(consumer, run),
        runs,
        {
          idleTimeoutMillis: TimeUtil.duration('10s', 'ms'),
          min: 1,
          max: consumerConfig.concurrency
        }
      );
    }

    return consumer.summarizeAsBoolean();
  }
}