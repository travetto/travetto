import * as commander from 'commander';
import { Util, CompletionConfig } from '@travetto/cli/src/util';

export function init() {
  return Util.program
    .command('swagger-spec')
    .option('-o, --output [output]', 'Output folder', './api-client')
    .action(async (cmd: commander.Command) => {


      process.env.SWAGGER_OUTPUT = cmd.output;

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.run();

      const { DependencyRegistry } = await import('@travetto/di');
      const { SwaggerService } = await import('../src/service');

      const instance = await DependencyRegistry.getInstance(SwaggerService);
      await instance.generate();
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('swagger-spec');
  c.task['swagger-spec'] = {
    '': [],
  };
}