import { Env, toConcrete } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { WebHttpServer, WebHttpConfig } from '@travetto/web-http-server';

import './config-override.ts';

@CliCommand({ runTarget: true })
export class SampleApp {

  preMain(): void {
    Env.TRV_ENV.set('prod');
    Env.NODE_ENV.set('production');
  }

  async main() {
    console.log('CUSTOM STARTUP');
    await RootRegistry.init();
    const ssl = await DependencyRegistry.getInstance(WebHttpConfig);
    ssl.ssl = true;

    // Configure server before running
    return DependencyRegistry.runInstance(toConcrete<WebHttpServer>());
  }
}