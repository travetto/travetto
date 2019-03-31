// @ts-check
const { FsUtil } = require('@travetto/boot');

function init() {
  const { Util } = require('@travetto/cli/src/util');
  return Util.program.command('script [file] [method]')
    .option('-p, --phase [run phase]', 'The run phase to execute', 'init')
    .allowUnknownOption()
    .action(async (file, method, cmd) => {
      if (!file) {
        Util.showHelp(cmd, 'You must specify the file you want to start');
      }
      process.env.QUIET_INIT = ('QUIET_INIT' in process.env) ? process.env.QUIET_INIT : '1';
      process.env.DEBUG = ('DEBUG' in process.env) ? process.env.DEBUG : '0';

      const { start } = require('./lib');

      await start(cmd.phase);

      let res;

      try {
        res = require(FsUtil.resolveUnix(FsUtil.cwd, cmd));
      } catch {
        res = require(script);
      }

      if (res && method) {
        res[method]();
      }
    });
}

function complete(c) {
  c.all.push('script');
  c.script = {
    '': ['--phase', ''],
    '--phase': ['init', 'compile']
  };
}

module.exports = { complete, init };