// @ts-check
const { Util } = require('@travetto/cli/src/util');

function init() {
  return Util.program
    .command('swagger-client')
    .option('-o, --output [output]', 'Output folder', './api-client')
    .option('-f, --format [format]', 'Client format', 'typescript-angular')
    .option('-a, --additional-properties [props]', 'Additional format properties', 'supportsES6=true,ngVersion=6.1')
    .action(async (cmd) => {

      process.env.API_CLIENT_OUTPUT = cmd.output;
      process.env.API_CLIENT_FORMAT = cmd.format;
      process.env.API_CLIENT_FORMATOPTIONS = cmd.formatOptions;

      await require('@travetto/base/bin/bootstrap').run();
      const { ClientGenerate } = require('../src/client-generate');
      const { DependencyRegistry } = require('@travetto/di');

      const instance = await DependencyRegistry.getInstance(ClientGenerate);
      await instance.generate();
    });
}

function complete(c) {
  c.all.push('swagger-client');
  const formats = ['typescript-angular'];
  c['swagger-client'] = {
    '': ['--format', '--output', '--additional-properties'],
    '--format': formats,
    '-f': formats
  };
}

module.exports = { init, complete };