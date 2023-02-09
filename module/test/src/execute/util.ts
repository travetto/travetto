import { createReadStream } from 'fs';
import readline from 'readline';

import { ShutdownManager, TimeUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

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
  static async getTestFiles(globs: RegExp[]): Promise<string[]> {
    const files = RootIndex.findTest({})
      .filter(f => globs.some(g => g.test(f.import)));

    const validFiles = files
      .map(f => this.isTestFile(f.sourceFile).then(valid => ({ file: f.sourceFile, valid })));

    return (await Promise.all(validFiles))
      .filter(x => x.valid)
      .map(x => x.file);
  }
}