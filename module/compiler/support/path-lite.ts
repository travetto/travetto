import posix from 'node:path/posix';
import native from 'node:path';

export const toPosix = (file: string): string => file.replaceAll('\\', '/');
const cwd = (): string => toPosix(process.cwd());

export const path = {
  dirname: (file: string): string => posix.dirname(toPosix(file)),
  ...process.platform === 'win32' ? {
    resolve: (...args: string[]): string => toPosix(native.resolve(cwd(), ...args.map(toPosix))),
    join: (root: string, ...args: string[]): string => toPosix(native.join(toPosix(root), ...args.map(toPosix))),
  } : {
    resolve: (...args: string[]): string => posix.resolve(cwd(), ...args.map(toPosix)),
    join: (...args: string[]): string => posix.join(...args.map(toPosix)),
  }
};