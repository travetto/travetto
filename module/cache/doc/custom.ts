import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { MemoryModelService } from '@travetto/model-memory';
import { CacheModelSymbol } from '@travetto/cache';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(): ModelExpirySupport {
    return new CustomAwesomeModelService({});
  }
}

class CustomAwesomeModelService extends MemoryModelService {
  // Implement all the things
}