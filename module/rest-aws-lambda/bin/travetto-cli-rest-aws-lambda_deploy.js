//@ts-check

const { Util } = require('@travetto/cli/src/util');

function init() {
  return Util.program.command('rest-aws-lambda:deploy')
    .action((config, cmd) => {
      if (!config) {
        Util.showHelp(cmd);
      }
      console.log('To be implemented...');
    });
}

module.exports = { init };