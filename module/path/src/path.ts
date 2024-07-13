import posix from 'node:path/posix';
import native from 'node:path';

/**
 * Converts a given file name by replace all slashes, with forward slashes
 */
const toPosix = (file: string): string => file.replaceAll('\\', '/');
/**
 * Converts a given file name by replace all slashes, with platform dependent path separators
 */
const toNative = (file: string): string => file.replace(/[\\\/]+/g, native.sep);

const cwd = (): string => toPosix(process.cwd());

type PathModType =
  { toPosix: typeof toPosix } &
  Omit<typeof posix, 'posix' | 'win32'>;

const path: PathModType = {
  toPosix,
  relative: (from, to) => posix.relative(from, to),
  delimiter: posix.delimiter,
  sep: posix.sep,
  isAbsolute: (file) => posix.isAbsolute(toPosix(file)),
  toNamespacedPath: (file) => posix.toNamespacedPath(toPosix(file)),
  parse: (file) => posix.parse(toPosix(file)),
  format: (obj) => posix.format(obj),
  normalize: (file) => posix.normalize(toPosix(file)),
  basename: (file, suffix) => posix.basename(toPosix(file), suffix),
  extname: file => posix.extname(toPosix(file)),
  dirname: file => posix.dirname(toPosix(file)),
  resolve: (...args) => posix.resolve(cwd(), ...args.map(toPosix)),
  join: (...args) => posix.join(...args.map(toPosix)),
};

if (process.platform === 'win32') {
  path.relative = (from: string, to: string): string => toPosix(native.relative(toNative(from), toNative(to)));
  path.normalize = (root: string): string => toPosix(native.normalize(toNative(root)));
  path.resolve = (...args: string[]): string => toPosix(native.resolve(cwd(), ...args.map(toPosix)));
  path.join = (root: string, ...args: string[]): string => toPosix(native.join(toPosix(root), ...args.map(toPosix)));
}

export default path;