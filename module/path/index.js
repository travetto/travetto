const { extname, basename, dirname, resolve, join, relative, sep } = require('path');

const posix = (val) => val.replaceAll('\\', '/');

const cwd = posix(process.cwd());

module.exports = {
  cwd: () => posix(process.cwd()),
  extname: (file) => posix(extname(file)),
  basename: (file) => posix(basename(file)),
  dirname: (file) => posix(dirname(file)),
  resolve: (...args) => posix(resolve(cwd(), ...args.map(f => posix(f)))),
  join: (root, ...args) => posix(join(posix(root), ...args.map(f => posix(f)))),
  relative: (start, end) => posix(relative(start.replace(/[\\/]/g, sep), end.replace(/[\\/]/g, sep)))
};