import { InjectableFactory } from '@travetto/di';

import { type DependentService, CustomService } from './dependency.ts';

class Config {
  @InjectableFactory()
  static initService(dependentService: DependentService) {
    return new CustomService(dependentService);
  }
}

