// @ts-check

function clean() {
  require('../src/bootstrap/cache').AppCache.clear();
}

function init() {
  const { Util } = require('@travetto/cli/src/util');
  return Util.program.command('clean')
    .option('-q, --quiet', 'Quiet operation')
    .action(cmd => {

      const { FsUtil } = require('../src/bootstrap/fs-util');
      const { AppCache } = require('../src/bootstrap/cache');

      try {
        FsUtil.unlinkRecursiveSync(AppCache.cacheDir);
        if (!cmd.quiet) {
          console.log(`${Util.colorize.success('Successfully')} deleted temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
        }
      } catch (e) {
        console.error(`${Util.colorize.failure('Failed')} to delete temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
      }
    });
}

if (!process.env.TRV_CLI) {
  clean();
}

module.exports = { init };