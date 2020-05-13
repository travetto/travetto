import * as fs from 'fs';
import * as readline from 'readline';

import { EnvUtil } from '@travetto/boot';
import { ScanFs, Env, ShutdownManager } from '@travetto/base';

const TEST_TIMEOUT = EnvUtil.getTime('TRV_TEST_TIMEOUT', 5000);

// TODO: Document
export class TestUtil {
  static TIMEOUT = Symbol.for('@trv:test/timeout');

  static registerCleanup(scope: string) {
    ShutdownManager.onShutdown(`test.${scope}.bufferOutput`,
      () => new Promise(res => setTimeout(res, 50)));
  }

  static asyncTimeout(duration: number = TEST_TIMEOUT): [Promise<any>, Function] {
    let id: NodeJS.Timer;
    if (EnvUtil.isTrue('TRV_TEST_DEBUGGER')) {
      duration = 600000; // 10 minutes
    }
    const prom = new Promise((__, reject) => {
      id = setTimeout(() => reject(this.TIMEOUT), duration);
      id.unref();
    });
    return [prom, () => clearTimeout(id)];
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