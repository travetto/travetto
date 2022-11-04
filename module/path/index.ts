import * as path from 'path';

const posix = (val: string): string => val.replaceAll('\\', '/');

export const toPosix = posix;
export const cwd = () => posix(process.cwd());
export const extname = (file: string): string => posix(path.extname(file));
export const basename = (file: string): string => posix(path.basename(file));
export const dirname = (file: string): string => posix(path.dirname(file));
export const resolve = (...args: string[]): string => posix(path.resolve(cwd(), ...args.map(f => posix(f))));
export const join = (root: string, ...args: string[]): string => posix(path.join(posix(root), ...args.map(f => posix(f))));