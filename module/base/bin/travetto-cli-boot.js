// @ts-check

function init() {
  const { Util } = require('@travetto/cli/src/util');
  return Util.program.command('boot [script] [method]')
    .option('-p, --phase [run phase]', 'The run phase to execute', 'bootstrap')
    .allowUnknownOption()
    .action(async (script, method, cmd) => {
      if (!script) {
        Util.showHelp(cmd, 'You must specify the script you want to boot');
      }
      process.env.QUIET_INIT = ('QUIET_INIT' in process.env) ? process.env.QUIET_INIT : '1';
      process.env.DEBUG = ('DEBUG' in process.env) ? process.env.DEBUG : '0';

      const { runScript } = require('./lib');

      const res = await runScript(script, cmd.phase);

      if (res && method) {
        res[method]();
      }
    });
}

function complete(c) {
  c.all.push('boot');
  c.boot = {
    '': ['--phase', ''],
    '--phase': ['bootstrap', 'compile']
  };
}

module.exports = { complete, init };