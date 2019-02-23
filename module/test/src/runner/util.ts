import * as fs from 'fs';
import * as readline from 'readline';

import { ScanFs, Env } from '@travetto/base';

const DEFAULT_TIMEOUT = Env.getInt('DEFAULT_TIMEOUT', 5000);

export class TestUtil {
  static TIMEOUT = Symbol('timeout');

  static asyncTimeout(duration: number = DEFAULT_TIMEOUT): [Promise<any>, Function] {
    let id: NodeJS.Timer;
    if (Env.isTrue('DEBUGGER')) {
      duration = 600000; // 10 minutes
    }
    const prom = new Promise((_, reject) => {
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