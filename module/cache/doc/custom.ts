import { InjectableFactory } from '@travetto/di';
import { MemoryModelService, ModelExpirySupport } from '@travetto/model';
import { CacheModelⲐ } from '@travetto/cache';

class Config {
  @InjectableFactory(CacheModelⲐ)
  static getModel(): ModelExpirySupport {
    return new CustomAwesomeModelService({});
  }
}

class CustomAwesomeModelService extends MemoryModelService {
  // Implement all the things
}