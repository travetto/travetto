// @ts-check

function init() {
  const { Util } = require('@travetto/cli/src/util');
  return Util.program.command('clean')
    .option('-q, --quiet', 'Quiet operation')
    .action(cmd => {
      const { AppCache } = require('../bootstrap/cache');
      try {
        require('./lib').clean();
        if (!cmd.quiet) {
          console.log(`${Util.colorize.success('Successfully')} deleted temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
        }
      } catch (e) {
        console.error(`${Util.colorize.failure('Failed')} to delete temp dir ${Util.colorize.path(AppCache.cacheDir)}`);
      }
    });
}

function complete(c) {
  c.all.push('clean');
  c.clean = {
    '': ['--quiet']
  };
}

module.exports = { complete, init };