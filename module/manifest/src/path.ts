import type * as pathMod from 'path';
import { extname, dirname, basename, resolve, join } from 'path/posix';
import { sep, resolve as nativeResolve, join as nativeJoin } from 'path';

/**
 * Converts a given file name by replace all slashes, with forward slashes
 */
const toPosix = (file: string): string => file.replaceAll('\\', '/');
/**
 * Converts a given file name by replace all slashes, with platform dependent path separators
 */
const toNative = (file: string): string => file.replace(/[\\\/]+/g, sep);

const cwd = (): string => toPosix(process.cwd());

type PathModType =
  { toPosix: typeof toPosix, toNative: typeof toNative } &
  Pick<typeof pathMod, 'basename' | 'dirname' | 'extname' | 'join' | 'resolve'> &
  Pick<typeof process, 'cwd'>;

export const path: PathModType = {
  cwd,
  toPosix,
  toNative,
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
