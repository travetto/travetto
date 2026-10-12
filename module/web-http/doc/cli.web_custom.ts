import { CliCommand } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Env, toConcrete } from '@travetto/runtime';
import { WebHttpConfig, type WebHttpServer } from '@travetto/web-http';

import './config-override.ts';

@CliCommand({ runTarget: true })
export class SampleApp {
  async main() {
    Env.NODE_ENV.set('production');

    console.log('CUSTOM STARTUP');
    await Registry.init();
    const config = await DependencyRegistryIndex.getInstance(WebHttpConfig);
    config.tls = true;

    // Configure server before running
    const instance = await DependencyRegistryIndex.getInstance(toConcrete<WebHttpServer>());
    const { complete } = await instance.serve();
    return complete;
  }
}
