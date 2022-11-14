import * as path from 'path';

const posix = (val: string): string => val.replaceAll('\\', '/');
export const cwd = (): string => posix(process.cwd());
export const resolve = (...args: string[]): string => posix(path.resolve(cwd(), ...args.map(f => posix(f))));
export const nativeSep = path.sep;