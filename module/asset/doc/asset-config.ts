import { InjectableFactory } from '@travetto/di';
import { S3ModelService } from '@travetto/model-s3';
import { AssetModelⲐ, AssetService } from '@travetto/asset';

class SymoblBasedConfiguration {
  @InjectableFactory(AssetModelⲐ)
  static getAssetModelService(service: S3ModelService) {
    return service;
  }
}

/* OR */

class FullConfiguration {
  @InjectableFactory()
  static getAssetService(service: S3ModelService) {
    return new AssetService(service);
  }
}