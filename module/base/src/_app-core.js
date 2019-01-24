const os = require('os');
const { FsUtil } = require('./fs/fs-util');

const cwd = FsUtil.toURI(process.env.INIT_CWD || process.cwd()).replace(/[\/]$/, '');
const defCache = FsUtil.resolveURI(os.tmpdir(), cwd.replace(/[\/:]/g, '_'));

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