import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { CacheModelSym } from '@travetto/cache';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(): ModelExpirySupport {
    // @ts-expect-error
    return new CustomAwesomeModelService();
  }
}

// @ts-expect-error
class CustomAwesomeModelService implements ModelExpirySupport {
  // Implement all the things
}