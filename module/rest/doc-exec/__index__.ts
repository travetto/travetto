'@Application';
import { InjectableFactory } from '@travetto/di';
import { RestServer } from '@travetto/rest';

export * from '@travetto/rest/doc/custom-app';

class Config {
  @InjectableFactory()
  static target(): RestServer<unknown> {
    return { init: () => { }, listen: () => { }, registerRoutes: () => { } } as unknown as RestServer;
  }
}