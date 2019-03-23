// @ts-check
function init() {
  const { Util } = require('@travetto/cli/src/util');

  return Util.program
    .command('es:schema')
    .option('-a, --app [app]', 'Application to export, (default: .)')
    .action(async (cmd) => {
      process.env.DEBUG = '0';
      process.env.TRACE = '0';
      process.env.QUIET_INIT = '1';
      process.env.APP_ROOTS = cmd.app ? `./${cmd.app}` : '.';
      process.env.PROFILE = cmd.app || '';
      console.log(JSON.stringify(await (require('./lib').getSchemas()), null, 2));
    });
}

async function complete(c) {
  c.all.push('es:schema');
}

module.exports = { init, complete };