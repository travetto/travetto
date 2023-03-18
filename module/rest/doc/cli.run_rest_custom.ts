import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { RestApplication, RestSslConfig } from '@travetto/rest';

@CliCommand()
export class SampleApp {

  envInit(): GlobalEnvConfig {
    return { envName: 'prod' };
  }

  async main() {
    console.log('CUSTOM STARTUP');
    await RootRegistry.init();
    const ssl = await DependencyRegistry.getInstance(RestSslConfig);
    ssl.active = true;

    // Configure server before running
    return DependencyRegistry.runInstance(RestApplication);
  }
}