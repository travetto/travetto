import type * as pathMod from 'node:path';
import { extname, dirname, basename, resolve, join } from 'node:path/posix';
import { resolve as nativeResolve, join as nativeJoin } from 'node:path';

/**
 * Converts a given file name by replace all slashes, with forward slashes
 */
const toPosix = (file: string): string => file.replaceAll('\\', '/');

const cwd = (): string => toPosix(process.cwd());

type PathModType =
  { toPosix: typeof toPosix } &
  Pick<typeof pathMod, 'basename' | 'dirname' | 'extname' | 'join' | 'resolve'>;

export const path: PathModType = {
  toPosix,
  basename: (file, suffix) => basename(toPosix(file), suffix),
  extname: file => extname(toPosix(file)),
  dirname: file => dirname(toPosix(file)),
  resolve: (...args) => resolve(cwd(), ...args.map(toPosix)),
  join: (...args) => join(...args.map(toPosix)),
};

if (process.platform === 'win32') {
  path.resolve = (...args: string[]): string => toPosix(nativeResolve(cwd(), ...args.map(toPosix)));
  path.join = (root: string, ...args: string[]): string => toPosix(nativeJoin(toPosix(root), ...args.map(toPosix)));
}
