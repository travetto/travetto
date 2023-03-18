'@Application';
import { InjectableFactory } from '@travetto/di';
import { RestServer } from '@travetto/rest';

class Config {
  @InjectableFactory()
  static target(): RestServer<unknown> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      init: () => { },
      listen: () => { },
      registerRoutes: () => { }
    } as unknown as RestServer;
  }
}