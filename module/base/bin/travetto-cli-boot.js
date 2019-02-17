//@ts-check

function init() {
  const { Util } = require('@travetto/cli/src/util');
  return Util.program.command('boot [script] [method]')
    .option('-p, --phase [run phase]', 'The run phase to execute', 'bootstrap')
    .allowUnknownOption()
    .action(async (script, method, cmd) => {
      if (!script) {
        Util.showHelp(cmd);
      }
      process.env.QUIET_INIT = ('QUIET_INIT' in process.env) ? process.env.QUIET_INIT : '1';
      process.env.DEBUG = ('DEBUG' in process.env) ? process.env.DEBUG : '0';

      require('./bootstrap');

      if (cmd.phase && cmd.phase !== 'none') {
        const { PhaseManager } = require('../src/phase');
        const mgr = new PhaseManager(cmd.phase);
        mgr.load();
        await mgr.run();
      }

      let res;
      try {
        const { FsUtil } = require('../src/bootstrap/fs-util');
        res = require(FsUtil.resolveUnix(FsUtil.cwd, script));
      } catch {
        res = require(script);
      }
      if (res && method) {
        res[method]();
      }
    });
}

module.exports = { init };