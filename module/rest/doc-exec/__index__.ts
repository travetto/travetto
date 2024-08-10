'@Application';
import { InjectableFactory } from '@travetto/di';
import { RestServer, ServerHandle } from '@travetto/rest';
import { impartial } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(): RestServer<unknown> {
    return impartial<RestServer>({
      init: () => { },
      listen: () => impartial<ServerHandle>({}),
      registerRoutes: async () => { }
    });
  }
}