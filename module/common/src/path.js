const { delimiter, extname, basename, dirname, resolve, join } = require('path');

const posix = val => val.replaceAll('\\', '/');

const cwd = () => posix(process.cwd());

const path = {
  toPosix: posix,
  delimiter,
  cwd,
  extname: file => posix(extname(file)),
  basename: file => posix(basename(file)),
  dirname: file => posix(dirname(file)),
  resolve: (...args) => posix(resolve(cwd(), ...args.map(f => posix(f)))),
  join: (root, ...args) => posix(join(posix(root), ...args.map(f => posix(f)))),
};


module.exports = { path };