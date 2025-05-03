import { Cancelable } from '@travetto/runtime';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { WebHttpServer } from '@travetto/web-http-server';
import { ConfigurationService } from '@travetto/config';

class Config {
  @InjectableFactory()
  static target(): WebHttpServer {
    return {
      async serve(): Promise<Cancelable> {
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        console.log('Listening');
        return () => { };
      }
    };
  }
}