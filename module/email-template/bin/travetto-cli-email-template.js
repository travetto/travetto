// @ts-check

const { Util } = require('@travetto/cli/src/util');

function init() {
  return Util.program.command('email-template').action(async (cmd) => {
    const { Server } = require('@travetto/cli/src/http');
    await (require('@travetto/base/bin/bootstrap').run());
    const handler = await require('./email-server').serverHandler();
    Server({ handler, port: 3839, open: true });
  });
}

function complete(c) {
  c.all.push('email-template');
}

module.exports = { init, complete };