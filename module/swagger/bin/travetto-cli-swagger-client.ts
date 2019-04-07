import * as commander from 'commander';
import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {
  return Util.program
    .command('swagger-client')
    .option('-o, --output [output]', 'Output folder', './api-client')
    .option('-f, --format [format]', 'Client format', 'typescript-angular')
    .option('-a, --additional-properties [props]', 'Additional format properties', 'supportsES6=true,ngVersion=6.1')
    .action(async (cmd: commander.Command) => {

      process.env.API_CLIENT_OUTPUT = cmd.output;
      process.env.API_CLIENT_FORMAT = cmd.format;
      process.env.API_CLIENT_FORMATOPTIONS = cmd.formatOptions;

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.run();

      const { DependencyRegistry } = await import('@travetto/di');
      const { ClientGenerate } = await import('../src/client-generate');

      const instance = await DependencyRegistry.getInstance(ClientGenerate);
      await instance.generate();
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('swagger-client');
  const formats = ['typescript-angular'];
  c.task['swagger-client'] = {
    '': ['--format', '--output', '--additional-properties'],
    '--format': formats,
    '-f': formats
  };
}