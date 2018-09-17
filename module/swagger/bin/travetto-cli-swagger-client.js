//@ts-check
// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

module.exports = function() {
  program
    .command('swagger-client')
    .option('-o, --output [output]', 'Output folder', './api-client')
    .option('-f, --format [format]', 'Client format', 'typescript-angular')
    .option('-a, --additional-properties [props]', 'Additional format properties', 'supportsES6=true,ngVersion=6.1')
    .action((cmd) => {

      process.env.API_CLIENT_OUTPUT = cmd.output;
      process.env.API_CLIENT_FORMAT = cmd.format;
      process.env.API_CLIENT_FORMATOPTIONS = cmd.formatOptions;
      process.env.WATCH = 'false';

      require('@travetto/base/bin/bootstrap').run(() => {
        const { ClientGenerate } = require('../src/client-generate');
        const { DependencyRegistry } = require('@travetto/di');

        return DependencyRegistry
          .getInstance(ClientGenerate)
          .then(x => x.generate());
      });
    });
};