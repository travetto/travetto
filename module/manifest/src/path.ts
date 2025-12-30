import posix from 'node:path/posix';
import win32 from 'node:path/win32';
import native from 'node:path';

const toPosix = (file: string): string => file.replaceAll('\\', '/');
const toNative = (file: string): string => file.replace(/[\/]/g, native.sep);
const cwd = (): string => toPosix(process.cwd());

const path: typeof posix & {
  native: typeof posix;
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
  matchesGlob: (file, pattern) => posix.matchesGlob(toPosix(file), toPosix(pattern)),
  ...process.platform === 'win32' ? {
    resolve: (...args) => toPosix(native.resolve(cwd(), ...args.map(toPosix))),
    join: (root, ...args) => toPosix(native.join(toPosix(root), ...args.map(toPosix))),
    relative: (from, to) => toPosix(native.relative(toPosix(from), toPosix(to))),
    isAbsolute: (file) => native.isAbsolute(toPosix(file)),
    normalize: (file) => toPosix(native.normalize(toPosix(file))),
    parse: (file) => native.parse(toPosix(file)),
    format: (value) => toPosix(native.format(value)),
    toNamespacedPath: (file) => toPosix(native.toNamespacedPath(toPosix(file))),
  } : {
    relative: (from, to) => posix.relative(toPosix(from), toPosix(to)),
    resolve: (...args) => posix.resolve(cwd(), ...args.map(toPosix)),
    join: (...args) => posix.join(...args.map(toPosix)),
    isAbsolute: file => posix.isAbsolute(toPosix(file)),
    normalize: file => posix.normalize(toPosix(file)),
    parse: file => posix.parse(toPosix(file)),
    format: value => posix.format(value),
    toNamespacedPath: file => toPosix(file),
  }
};

export default path;