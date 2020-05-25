import * as commander from 'commander';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin {
  name = 'openapi-spec';
  init(cmd: commander.Command) {
    return cmd.option('-o, --output [output]', 'Output files', './openapi.yml');
  }

  async action() {
    process.env.API_SPEC_OUTPUT = this._cmd.output;

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();

    const { DependencyRegistry } = await import('@travetto/di');
    const { OpenApiService } = await import('../src/service');

    const instance = await DependencyRegistry.getInstance(OpenApiService);
    await instance.spec;
  }
}