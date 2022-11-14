import { extname, basename, dirname, resolve, join } from 'path';

const posix = (val: string): string => val.replaceAll('\\', '/');

const cwd = () => posix(process.cwd());

export const path = {
  toPosix: posix,
  cwd,
  extname: (file: string): string => posix(extname(file)),
  basename: (file: string): string => posix(basename(file)),
  dirname: (file: string): string => posix(dirname(file)),
  resolve: (...args: string[]): string => posix(resolve(cwd(), ...args.map(f => posix(f)))),
  join: (root: string, ...args: string[]): string => posix(join(posix(root), ...args.map(f => posix(f)))),
};
