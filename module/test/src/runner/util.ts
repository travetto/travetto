import * as fs from 'fs';
import * as readline from 'readline';

import { ScanFs, FsUtil } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

/**
 * Simple Test Utilities
 */
export class TestUtil {
  /**
   * Add 50 ms to the shutdown to allow for buffers to output properly
   */
  static registerCleanup(scope: string) {
    ShutdownManager.onShutdown(`test.${scope}.bufferOutput`,
      () => new Promise(res => setTimeout(res, 50)));
  }

  /**
   * Determine if a given file path is a valid test file
   */
  static isTest(file: string) {
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
  static async getTests(globs: RegExp[]) {
    const files = (await ScanFs.bulkScanDir(globs.map(x => ({ testFile: (y: string) => x.test(y) })), FsUtil.cwd))
      .filter(x => !x.stats.isDirectory())
      .filter(x => !x.file.includes('node_modules'))
      .map(f => this.isTest(f.file).then(valid => ({ file: f.file, valid })));

    return (await Promise.all(files))
      .filter(x => x.valid)
      .map(x => x.file);
  }
}