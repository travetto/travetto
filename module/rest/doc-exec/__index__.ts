'@Application';
import { InjectableFactory } from '@travetto/di';
import { RestServer, ServerHandle } from '@travetto/rest';
import { asFull } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(): RestServer<unknown> {
    return asFull<RestServer>({
      init: () => { },
      listen: () => asFull<ServerHandle>({}),
      registerRoutes: async () => { }
    });
  }
}