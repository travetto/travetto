import * as fs from 'fs';
import * as readline from 'readline';

import { ScanFs, Env, ShutdownManager } from '@travetto/base';

// TODO: Document
export class TestUtil {
  static registerCleanup(scope: string) {
    ShutdownManager.onShutdown(`test.${scope}.bufferOutput`,
      () => new Promise(res => setTimeout(res, 50)));
  }

  static isTest(file: string) {
    return new Promise<boolean>((resolve, reject) => {
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

  static async getTests(globs: RegExp[]) {
    const files = (await ScanFs.bulkScanDir(globs.map(x => ({ testFile: (y: string) => x.test(y) })), Env.cwd))
      .filter(x => !x.stats.isDirectory())
      .filter(x => !x.file.includes('node_modules'))
      .map(f => this.isTest(f.file).then(valid => ({ file: f.file, valid })));

    return (await Promise.all(files))
      .filter(x => x.valid)
      .map(x => x.file);
  }
}