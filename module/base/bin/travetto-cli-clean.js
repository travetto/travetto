//@ts-check

function clean() {
  require('../src/bootstrap/cache').AppCache.clear();
}

function init() {
  const { Util: { colorize, program } } = require('@travetto/cli/src/util');
  program.command('clean').action(() => {

    const { FsUtil } = require('../src/bootstrap/fs-util');
    const { AppCache } = require('../src/bootstrap/cache');

    try {
      FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
      console.log(`${colorize('Successfully', 'green')} deleted temp dir ${colorize(AppCache.cacheDir, 'white')}`);
    } catch (e) {
      console.error(`${colorize('Failed', 'red')} to delete temp dir ${colorize(AppCache.cacheDir, 'white')}`);
    }
  });
}

if (!process.env.TRV_CLI) {
  clean();
}

module.exports = { init };