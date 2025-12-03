import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import path from 'node:path';

import { Env, ExecUtil, ShutdownManager, Util, RuntimeIndex, Runtime } from '@travetto/runtime';
import { TestConfig, TestRun } from '../model/test.ts';

/**
 * Simple Test Utilities
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
        const src = Runtime.workspaceRelative(path.resolve(item));
        const match = allFiles.get(src);
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
   * @param globs
   * @returns
   */
  static async getTestDigest(globs: string[] = ['**/*.ts'], tags?: string[]): Promise<TestConfig[]> {
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
    return parsed.filter(testFilter);
  }

  /**
   * Get run events
   */
  static getTestRuns(tests: TestConfig[]): TestRun[] {
    const events = tests.reduce((acc, test) => {
      if (!acc.has(test.classId)) {
        acc.set(test.classId, { import: test.import, classId: test.classId, methodNames: [], runId: Util.uuid() });
      }
      acc.get(test.classId)!.methodNames!.push(test.methodName);
      return acc;
    }, new Map<string, TestRun>());
    return [...events.values()];
  }
}