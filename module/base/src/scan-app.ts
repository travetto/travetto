import { ScanEntry, ScanFs } from './scan-fs';
import { Env } from './env';

const cache: { [key: string]: ScanEntry[] } = {};

export class ScanApp {
  static findFiles(ext: string, filter?: (rel: string) => boolean) {
    if (!cache[ext]) {
      cache[ext] = ScanFs.scanDirSync({
        testFile: x => x.endsWith(ext),
        testDir: x =>
          !x.includes('node_modules') ||
          x.endsWith('node_modules') ||
          x.includes('@travetto')
      }, Env.cwd)
        .filter(ScanFs.isNotDir);

      if (Env.frameworkDev) {
        cache[ext] = cache[ext]
          .map(x => {
            if (x.file.includes('node_modules/@travetto')) {
              x.file = `${Env.cwd}/node_modules/@travetto/${x.file.split('node_modules/@travetto/').pop()}`;
            }
            return x;
          });
      }
    }

    if (filter) {
      return cache[ext].filter(x => filter(x.module));
    } else {
      return cache[ext].slice(0);
    }
  }

  static requireFiles(ext: string, filter: (rel: string) => boolean) {
    return ScanApp.findFiles(ext, filter).map(x => require(x.file.replace(/[\\]/g, '/')));
  }
}