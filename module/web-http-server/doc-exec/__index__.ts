import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { WebHttpServer } from '@travetto/web-http-server';
import { ConfigurationService } from '@travetto/config';
import { RunResponse } from '@travetto/cli';

class Config {
  @InjectableFactory()
  static target(): WebHttpServer {
    return {
      async run(): Promise<RunResponse> {
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        console.log('Listening');
        return { on(): void { }, close(): void { } };
      }
    } satisfies WebHttpServer;
  }
}