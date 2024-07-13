import posix from 'node:path/posix';
import win32 from 'node:path/win32';
import native from 'node:path';

const toPosix = (file: string): string => file.replaceAll('\\', '/');
const toNative = (file: string): string => file.replace(/[\/]/g, native.sep);
const cwd = (): string => toPosix(process.cwd());

export const path: posix.PlatformPath & {
  native: posix.PlatformPath;
  toPosix: typeof toPosix;
  toNative: typeof toNative;
} = {
  sep: posix.sep,
  delimiter: posix.delimiter,
  posix,
  win32,
  native,
  basename: (file, suffix) => posix.basename(toPosix(file), suffix),
  extname: file => posix.extname(toPosix(file)),
  dirname: file => posix.dirname(toPosix(file)),
  toNative,
  toPosix,
  ...process.platform === 'win32' ? {
    resolve: (...args) => toPosix(native.resolve(cwd(), ...args.map(toPosix))),
    join: (root, ...args) => toPosix(native.join(toPosix(root), ...args.map(toPosix))),
    relative: (from, to) => toPosix(native.relative(toPosix(from), toPosix(to))),
    isAbsolute: (file) => native.isAbsolute(toPosix(file)),
    normalize: (file) => toPosix(native.normalize(toPosix(file))),
    parse: (file) => native.parse(toPosix(file)),
    format: (obj) => toPosix(native.format(obj)),
    toNamespacedPath: (file) => toPosix(native.toNamespacedPath(toPosix(file))),
  } : {
    relative: (from, to) => posix.relative(toPosix(from), toPosix(to)),
    resolve: (...args) => posix.resolve(cwd(), ...args.map(toPosix)),
    join: (...args) => posix.join(...args.map(toPosix)),
    isAbsolute: file => posix.isAbsolute(toPosix(file)),
    normalize: file => posix.normalize(toPosix(file)),
    parse: file => posix.parse(toPosix(file)),
    format: obj => posix.format(obj),
    toNamespacedPath: file => toPosix(file),
  }
};

export default path;