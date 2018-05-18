import * as fs from 'fs';
import { Entry, scanDirSync } from './scan-fs';

const cache: { [key: string]: Entry[] } = {};

const CACHE_NAME = process.env.TS_CACHE_NAME;

export function findAppFilesByExt(ext: string) {
  if (!cache[ext]) {
    cache[ext] = scanDirSync({
      testFile: x => x.endsWith(ext),
      testDir: x => {
        return (!CACHE_NAME || x !== CACHE_NAME) &&
          (!x.includes('node_modules') || (
            x.endsWith('node_modules') ||
            x.includes('@travetto'))
          )
      }
    }, process.cwd())
      .filter(x => !x.stats.isDirectory())
  }
  return cache[ext].slice(0);
}

export function findAppFiles(ext: string, pattern: RegExp) {
  return findAppFilesByExt(ext).filter(x => pattern.test(x.file));
}

export function requireAppFiles(ext: string, pattern: RegExp) {
  return findAppFiles(ext, pattern).map(x => require(x.file));
}