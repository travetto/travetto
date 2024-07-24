import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';

import { Env, ExecUtil, ShutdownManager, Util, RuntimeIndex } from '@travetto/base';
import type { IndexedFile } from '@travetto/manifest';

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
  static isTestFile(file: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const input = createReadStream(file);
      const reader = readline.createInterface({ input })
        .on('line', line => {
          if (line.includes('@Suite')) {
            resolve(true);
            reader.close();
          }
        })
        .on('end', resolve.bind(null, false))
        .on('close', resolve.bind(null, false));
    });
  }

  /**
   * Find all valid test files given the globs
   */
  static async getTestFiles(globs?: RegExp[]): Promise<IndexedFile[]> {
    const files = RuntimeIndex.find({
      module: m => m.roles.includes('test') || m.roles.includes('std'),
      folder: f => f === 'test',
      file: f => f.role === 'test'
    })
      .filter(f => globs?.some(g => g.test(f.sourceFile)) ?? true);

    const validFiles = files
      .map(f => this.isTestFile(f.sourceFile).then(valid => ({ file: f, valid })));

    return (await Promise.all(validFiles))
      .filter(x => x.valid)
      .map(x => x.file);
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

  /**
   * Determine if we should invoke the debugger
   */
  static get tryDebugger(): boolean {
    return Env.TRV_TEST_BREAK_ENTRY.isTrue;
  }
}