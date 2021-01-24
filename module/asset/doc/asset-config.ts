import { InjectableFactory } from '@travetto/di';
import { S3ModelService } from '@travetto/model-s3';
import { AssetModelSym, AssetService } from '../src/service';

class SymoblBasedConfiguration {
  @InjectableFactory(AssetModelSym)
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