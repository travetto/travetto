import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model-core';
import { CacheModelSymbol } from '../../../src/service';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(): ModelExpirySupport {
    // @ts-expect-error
    return new CustomAwesomeModelService();
  }
}

// @ts-expect-error
class CustomAwesomeModelService implements ModelExpirySupport {
  // Implement all the things
}