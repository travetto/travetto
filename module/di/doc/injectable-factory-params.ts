import { InjectableFactory } from '@travetto/di';

import { DependentService, CustomService } from './dependency.ts';

class Config {
  @InjectableFactory()
  static initService(dependentService: DependentService) {
    return new CustomService(dependentService);
  }
}

