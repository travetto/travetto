import * as path from 'path';

import { Entry, scanDirSync } from './scan-fs';
import { AppEnv } from './env';

const cache: { [key: string]: Entry[] } = {};

export function findAppFilesByExt(ext: string, filter?: (rel: string) => boolean) {
  if (!cache[ext]) {
    cache[ext] = scanDirSync({
      testFile: x => x.endsWith(ext),
      testDir: x =>
        !x.includes('node_modules') ||
        x.endsWith('node_modules') ||
        x.includes('@travetto')
    }, AppEnv.cwd)
      .filter(x => !x.stats.isDirectory());
  }
  if (filter) {
    return cache[ext].filter(x => x.file.replace(`${AppEnv.cwd}${path.sep}`, '').replace(/[\\]+/g, '/'));
  } else {
    return cache[ext].slice(0);
  }
}

export function findAppFiles(ext: string, filter: (rel: string) => boolean) {
  return findAppFilesByExt(ext, filter);
}

export function requireAppFiles(ext: string, filter: (rel: string) => boolean) {
  return findAppFiles(ext, filter).map(x => require(x.file.replace(/[\\]/g, '/')));
}