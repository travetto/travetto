import { InjectableFactory } from '@travetto/di';
import { S3AssetSource, S3AssetConfig } from '../../..';

class AppConfig {
  @InjectableFactory()
  static getSource(cfg: S3AssetConfig) {
    return new S3AssetSource(cfg);
  }
}