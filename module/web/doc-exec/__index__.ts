'@Application';
import { InjectableFactory } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle } from '@travetto/web';
import { asFull } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(config: WebConfig): WebServer<unknown> {
    return asFull<WebServer>({
      init: () => { },
      listen: () => asFull<WebServerHandle>({ port: config.port }),
      registerEndpoints: async () => { }
    });
  }
}