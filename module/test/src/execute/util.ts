import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';

import { Env, ExecUtil, ShutdownManager, Util, RuntimeIndex, Runtime } from '@travetto/runtime';

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
      module: m => m.roles.includes('test') || m.roles.includes('std'),
      folder: f => f === 'test',
      file: f => f.role === 'test'
    });

    // Collect globs
    if (globs?.length) {
      const allFiles = new Map(all.map(x => [x.sourceFile, x]));
      for await (const item of fs.glob(globs)) {
        const src = Runtime.workspaceRelative(item);
        const match = allFiles.get(src);
        if (match && await this.isTestFile(match.sourceFile)) {
          yield match.import;
        }
      }
    } else {
      for await (const match of all) {
        if (match && await this.isTestFile(match.sourceFile)) {
          yield match.import;
        }
      }
    }
  }

  /**
   * Get count of tests for a given set of patterns
   * @param patterns
   * @returns
   */
  static async getTestCount(patterns: string[]): Promise<number> {
    const countRes = await ExecUtil.getResult(
      spawn('npx', ['trv', 'test:count', ...patterns], {
        env: { ...process.env, ...Env.FORCE_COLOR.export(0), ...Env.NO_COLOR.export(true) }
      }),
      { catch: true }
    );
    if (!countRes.valid) {
      throw new Error(countRes.stderr);
    }
    return countRes.valid ? +countRes.stdout : 0;
  }
}