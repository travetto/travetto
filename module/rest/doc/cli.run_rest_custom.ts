import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { RestApplication, RestSslConfig } from '@travetto/rest';

import './config-override';

@CliCommand({ runTarget: true })
export class SampleApp {

  preMain(): void {
    Env.TRV_ENV.set('prod');
    Env.NODE_ENV.set('production');
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