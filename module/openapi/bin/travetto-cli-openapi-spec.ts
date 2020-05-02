import * as commander from 'commander';
import { CliUtil, CompletionConfig } from '@travetto/cli/src/util';

// TODO: Document
export function init() {
  return CliUtil.program
    .command('openapi-spec')
    .option('-o, --output [output]', 'Output files', './openapi.yml')
    .action(async (cmd: commander.Command) => {
      process.env.OPENAPI_OUTPUT = cmd.output;

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.bootstrap();

      const { DependencyRegistry } = await import('@travetto/di');
      const { OpenApiService } = await import('../src/service');

      const instance = await DependencyRegistry.getInstance(OpenApiService);
      await instance.generate();
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('openapi-spec');
  c.task['openapi-spec'] = {
    '': [],
  };
}