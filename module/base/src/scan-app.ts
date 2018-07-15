import { ScanEntry, ScanFs } from './scan-fs';
import { Env } from './env';
import { resolveFrameworkFile } from './app-info';

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
        cache[ext] = cache[ext].map(x => {
          x.file = resolveFrameworkFile(x.file);
          return x;
        });
      }

      // De-deduplicate
      cache[ext] = cache[ext]
        .sort((a, b) => a.file.localeCompare(b.file))
        .reduce((acc: ScanEntry[], x: ScanEntry) => {
          if (!acc.length || x.file !== acc[acc.length - 1].file) {
            acc.push(x);
          }
          return acc;
        }, []);
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