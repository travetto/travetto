import * as fs from 'fs';
import * as readline from 'readline';

import { ShutdownManager, Util } from '@travetto/base';
import { SourceIndex } from '@travetto/boot/src/internal/source';

/**
 * Simple Test Utilities
 */
export class RunnerUtil {
  /**
   * Add 50 ms to the shutdown to allow for buffers to output properly
   */
  static registerCleanup(scope: string) {
    ShutdownManager.onShutdown(`test.${scope}.bufferOutput`, () => Util.wait(50));
  }

  /**
   * Determine if a given file path is a valid test file
   */
  static isTestFile(file: string) {
    return new Promise<boolean>((resolve) => {
      const input = fs.createReadStream(file);
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
  static async getTestFiles(globs: RegExp[], root = 'test') {
    const files = SourceIndex.find({ folder: root, paths: ['.'] })
      .filter(f => globs.some(g => g.test(f.module)));

    const validFiles = files
      .map(f => this.isTestFile(f.file).then(valid => ({ file: f.file, valid })));

    return (await Promise.all(validFiles))
      .filter(x => x.valid)
      .map(x => x.file);
  }
}