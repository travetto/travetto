import * as path from 'path';

const posix = (val: string): string => val.replaceAll('\\', '/');

export const cwd = () => posix(process.cwd());
export const dirname = (file: string): string => posix(path.dirname(file));
export const resolve = (...args: string[]): string => posix(path.resolve(cwd(), ...args.map(f => posix(f))));