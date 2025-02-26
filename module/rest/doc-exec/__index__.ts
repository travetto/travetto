'@Application';
import { InjectableFactory } from '@travetto/di';
import { RestServer, RestServerHandle } from '@travetto/rest';
import { asFull } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(): RestServer<unknown> {
    return asFull<RestServer>({
      init: () => { },
      listen: () => asFull<RestServerHandle>({}),
      registerRoutes: async () => { }
    });
  }
}