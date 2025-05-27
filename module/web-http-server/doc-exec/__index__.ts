import { InjectableFactory } from '@travetto/di';
import { WebHttpConfig, WebHttpServer, WebServerHandle } from '@travetto/web-http-server';
import { ConfigurationService } from '@travetto/config';

class Config {
  @InjectableFactory()
  static target(config: WebHttpConfig, configService: ConfigurationService): WebHttpServer {
    return {
      async serve(): Promise<WebServerHandle> {
        console.log('Initialized', await configService.initBanner());
        console.log('Listening on port', { port: config.port });
        return {
          target: null!,
          complete: Promise.resolve(),
          stop: async (): Promise<void> => { },
        };
      },
    };
  }
}