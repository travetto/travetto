//@ts-check

// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

module.exports = function () {
  // @ts-ignore
  program.command('email-template').action(async (cmd) => {
    const { Server } = require('@travetto/cli/src/http');
    await (require('@travetto/base/bin/bootstrap').run());
    const handler = await require('./email-server').serverHandler();
    Server({ handler, port: 3839, open: true });
  });
};