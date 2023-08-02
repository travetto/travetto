import { extname, dirname, resolve, basename, join } from 'path/posix';
import { sep } from 'path';

const posix = (file: string): string => file.replaceAll('\\', '/');

const cwd = (): string => posix(process.cwd());

export const path = {
  cwd,
  toPosix: posix,
  basename: (file: string, suffix?: string): string => basename(posix(file), suffix),
  extname: (file: string): string => extname(posix(file)),
  dirname: (file: string): string => dirname(posix(file)),
  resolve: (...args: string[]): string => resolve(cwd(), ...args.map(f => posix(f))),
  join: (root: string, ...args: string[]): string => join(posix(root), ...args.map(f => posix(f))),
  toNative: (file: string): string => file.replaceAll('/', sep)
};