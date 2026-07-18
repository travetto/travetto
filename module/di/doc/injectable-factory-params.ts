import { InjectableFactory } from '@travetto/di';

import { CustomService, type DependentService } from './dependency.ts';

class Config {
  @InjectableFactory()
  static initService(dependentService: DependentService) {
    return new CustomService(dependentService);
  }
}
