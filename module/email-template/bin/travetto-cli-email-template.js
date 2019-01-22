//@ts-check

// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

module.exports = function () {
  // @ts-ignore
  program.command('email-template').action(async (cmd) => {
    await (require('@travetto/base/bin/bootstrap').run());
    const { runServer } = require('./email-server');
    runServer(3839);
  });
};