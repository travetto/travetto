import { InjectableFactory } from '@travetto/di';
import { S3AssetSource, S3ModelConfig } from '../../..';

class AppConfig {
  @InjectableFactory()
  static getSource(cfg: S3ModelConfig) {
    return new S3AssetSource(cfg);
  }
}