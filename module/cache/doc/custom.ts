import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { MemoryModelService } from '@travetto/model-memory';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(): ModelExpirySupport {
    return new CustomAwesomeModelService({});
  }
}

class CustomAwesomeModelService extends MemoryModelService {
  // Implement all the things
}
