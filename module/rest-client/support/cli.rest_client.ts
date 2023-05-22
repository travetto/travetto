import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

@CliCommand()
export class CliRestClientCommand implements CliCommandShape {

  force = false;

  envInit(): GlobalEnvConfig {
    return {
      envName: 'dev'
    };
  }

  async main(): Promise<void> {
    await RootRegistry.init();
    const { RestClientGeneratorService } = await import('../src/service.js');
    await DependencyRegistry.getInstance(RestClientGeneratorService);
  }
}