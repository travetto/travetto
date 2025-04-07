'@Application';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { WebConfig, WebApplication, WebApplicationHandle } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';

class Config {
  @InjectableFactory()
  static target(config: WebConfig): WebApplication {
    return {
      async run(): Promise<WebApplicationHandle> {
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        console.log('Listening', { port: config.port });
        return { on(): void { }, close(): void { } };
      }
    } satisfies WebApplication;
  }
}