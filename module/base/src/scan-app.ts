import { Entry, scanDirSync, isNotDir } from './scan-fs';
import { AppEnv } from './env';

const cache: { [key: string]: Entry[] } = {};

export function findAppFiles(ext: string, filter?: (rel: string) => boolean) {
  if (!cache[ext]) {
    cache[ext] = scanDirSync({
      testFile: x => x.endsWith(ext),
      testDir: x =>
        !x.includes('node_modules') ||
        x.endsWith('node_modules') ||
        x.includes('@travetto')
    }, AppEnv.cwd)
      .filter(isNotDir)
      .map(x => {
        if (x.file.includes('node_modules/@travetto')) {
          x.file = `${AppEnv.cwd}/node_modules/@travetto/${x.file.split('node_modules/@travetto/').pop()}`;
        }
        return x;
      })
      .sort((a, b) => a.file.localeCompare(b.file))
      .reduce((acc, el) => {
        if (!acc.length || acc[acc.length - 1].file !== el.file) {
          acc.push(el);
        }
        return acc;
      }, [] as Entry[]);
  }

  if (filter) {
    return cache[ext].filter(x => filter(x.module));
  } else {
    return cache[ext].slice(0);
  }
}

export function requireAppFiles(ext: string, filter: (rel: string) => boolean) {
  return findAppFiles(ext, filter).map(x => require(x.file.replace(/[\\]/g, '/')));
}