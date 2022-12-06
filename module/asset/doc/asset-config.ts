import { InjectableFactory } from '@travetto/di';
import { ModelStreamSupport } from '@travetto/model';
import { AssetModelⲐ, AssetService } from '@travetto/asset';

class SymbolBasedConfiguration {
  @InjectableFactory(AssetModelⲐ)
  static getAssetModelService(service: ModelStreamSupport) {
    return service;
  }
}

/* OR */

class FullConfiguration {
  @InjectableFactory()
  static getAssetService(service: ModelStreamSupport) {
    return new AssetService(service);
  }
}