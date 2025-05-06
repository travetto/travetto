import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { WebHttpConfig, WebHttpServer, WebHttpServerHandle } from '@travetto/web-http-server';
import { ConfigurationService } from '@travetto/config';

class Config {
  @InjectableFactory()
  static target(config: WebHttpConfig): WebHttpServer {
    return {
      async serve(): Promise<WebHttpServerHandle> {
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        console.log('Listening on port', { port: config.port });
        const { promise: wait, resolve: kill } = Promise.withResolvers<void>();
        return { wait, kill };
      }
    };
  }
}