import { createReadStream } from 'fs';
import readline from 'readline';

import { Env, ExecUtil, ShutdownManager, TimeUtil } from '@travetto/base';
import { IndexedFile, RootIndex } from '@travetto/manifest';

/**
 * Simple Test Utilities
 */
export class RunnerUtil {
  /**
   * Add 50 ms to the shutdown to allow for buffers to output properly
   */
  static registerCleanup(scope: string): void {
    ShutdownManager.onShutdown(`test.${scope}.bufferOutput`, () => TimeUtil.wait(50));
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
    const files = RootIndex.find({
      module: m => m.roles.includes('test') || m.roles.includes('std'),
      folder: f => f === 'test',
      file: f => f.role === 'test'
    })
      .filter(f => globs?.some(g => g.test(f.import)) ?? true);

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
    const proc = ExecUtil.spawn('npx', ['trv', 'test:count', ...patterns], { stdio: 'pipe', catchAsResult: true, env: { FORCE_COLOR: '0', NO_COLOR: '1' } });
    const countRes = await proc.result;
    if (!countRes.valid) {
      throw new Error(countRes.stderr);
    }
    return countRes.valid ? +countRes.stdout : 0;
  }

  /**
   * Determine if we should invoke the debugger
   */
  static get tryDebugger(): boolean {
    return Env.isTrue('TRV_TEST_BREAK_ENTRY');
  }
}