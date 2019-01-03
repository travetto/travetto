const path = require('path');
const os = require('os');

const cwd = (process.env.INIT_CWD || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');
let defCache = path.join(os.tmpdir(), cwd.replace(/[\\\/:]/g, '_'));
const cacheDir =
  process.env.TRV_CACHE_DIR ?
    (process.env.TRV_CACHE_DIR === 'PID' ?
      `${defCache}_${process.pid}` :
      process.env.TRV_CACHE_DIR
    ) :
    defCache;

module.exports = {
  cwd,
  cacheDir
}