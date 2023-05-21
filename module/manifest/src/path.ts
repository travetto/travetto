import { extname, dirname, resolve, basename, delimiter, join, sep } from 'path';

const posix = (file: string): string => file.replaceAll('\\', '/');

const cwd = (): string => posix(process.cwd());

export const path = {
  cwd,
  toPosix: posix,
  delimiter,
  basename: (file: string, suffix?: string): string => posix(basename(file, suffix)),
  extname: (file: string): string => posix(extname(file)),
  dirname: (file: string): string => posix(dirname(file)),
  resolve: (...args: string[]): string => posix(resolve(cwd(), ...args.map(f => posix(f)))),
  join: (root: string, ...args: string[]): string => posix(join(posix(root), ...args.map(f => posix(f)))),
  toNative: (file: string): string => file.replaceAll('/', sep)
};