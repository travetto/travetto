'@Application';
import { InjectableFactory } from '@travetto/di';
import { WebServer, WebServerHandle } from '@travetto/web';
import { asFull } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(): WebServer<unknown> {
    return asFull<WebServer>({
      init: () => { },
      listen: () => asFull<WebServerHandle>({}),
      registerEndpoints: async () => { }
    });
  }
}