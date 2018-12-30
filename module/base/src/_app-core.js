const path = require('path');
const os = require('os');

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');
const cacheDir = process.env.TS_CACHE_DIR || path.join(os.tmpdir(), cwd.replace(/[\\\/:]/g, '_'));

module.exports = {
  cwd,
  cacheDir
}