import type { ConfigurationService } from '@travetto/config';
import { InjectableFactory } from '@travetto/di';
import type { WebHttpConfig, WebHttpServer, WebServerHandle } from '@travetto/web-http';

class Config {
  @InjectableFactory({ primary: true })
  static target(config: WebHttpConfig, configService: ConfigurationService): WebHttpServer {
    return {
      async serve(): Promise<WebServerHandle> {
        console.log('Initialized', await configService.initBanner());
        console.log('Listening on port', { port: config.port });
        return {
          target: null!,
          complete: Promise.resolve(),
          stop: async (): Promise<void> => {}
        };
      }
    };
  }
}
