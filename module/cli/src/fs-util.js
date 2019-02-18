// @ts-check

const path = require('path');

const toUnix = (rest) => rest.replace(/[\\\/]+/g, '/');
const cwd = toUnix(process.env.INIT_CWD || process.cwd()).replace(/[\/]+$/, '');

const FsUtil = {
  cwd,
  toUnix,
  resolveUnix: (...rest) => toUnix(path.resolve(...rest)),
  joinUnix: (...rest) => toUnix(path.join(...rest))
};

module.exports = { FsUtil };