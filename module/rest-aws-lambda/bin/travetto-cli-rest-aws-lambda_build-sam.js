// @ts-check

const path = require('path');
const fs = require('fs');
const writeFile = (f, c) => fs.writeFileSync(f, c, 'utf-8');

const { Util } = require('@travetto/cli/src/util');
const { FsUtil } = require('@travetto/base/src/bootstrap/fs-util');

function init() {
  return Util.program
    .command('rest-aws-lambda:build-sam')
    .option('-e --env [env]', 'Environment name', 'prod')
    .option('-o --output [output]', 'Output file', 'dist/template.yml')
    .action(async (cmd) => {
      process.env.ENV = cmd.env;

      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      await require('@travetto/base/bin/bootstrap').run();
      const { ControllerRegistry } = require('@travetto/rest');

      await ControllerRegistry.init();
      const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

      const { template } = require(FsUtil.resolveUnix(__dirname, '../resources/template.yml.js'));
      const sam = template(controllers, FsUtil.resolveUnix(__dirname, '../resources'));

      writeFile(cmd.output, sam);
    });
}

module.exports = { init };