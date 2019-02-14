//@ts-check

function clean() {
  require('../src/cache').AppCache.clear();
}

function init() {
  const { Util: { colorize, program } } = require('@travetto/cli/src/util');
  const { FsUtil } = require('@travetto/cli/src/fs-util');
  program.command('clean').action(() => {

    const { AppCache } = require('../src/cache');

    try {
      FsUtil.unlinkDirSync(AppCache.cacheDir);
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