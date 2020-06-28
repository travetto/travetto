import { InjectableFactory } from '../../../src/decorator';
import { DependentService, CustomService } from './dep';

class Config {
  @InjectableFactory()
  static initService(dependentService: DependentService) {
    return new CustomService(dependentService);
  }
}

