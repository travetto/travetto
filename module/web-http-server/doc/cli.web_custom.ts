import { Env, toConcrete } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
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
    await Registry.init();
    const ssl = await DependencyRegistryIndex.getInstance(WebHttpConfig);
    ssl.tls = true;

    // Configure server before running
    const instance = await DependencyRegistryIndex.getInstance(toConcrete<WebHttpServer>());
    const { complete } = await instance.serve();
    return complete;
  }
}