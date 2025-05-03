import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { WebHttpServer, WebHttpServerHandle } from '@travetto/web-http-server';
import { ConfigurationService } from '@travetto/config';

class Config {
  @InjectableFactory()
  static target(): WebHttpServer {
    return {
      async serve(): Promise<WebHttpServerHandle> {
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        console.log('Listening');
        const { promise: wait, resolve: kill } = Promise.withResolvers<void>();
        return { wait, kill };
      }
    };
  }
}