import { InjectableFactory } from '@travetto/di';
import { MongoAssetSource, MongoAssetConfig } from '../../..';

class AppConfig {
  @InjectableFactory()
  static getSource(cfg: MongoAssetConfig) {
    return new MongoAssetSource(cfg);
  }
}