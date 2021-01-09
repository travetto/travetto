import { InjectableFactory } from '@travetto/di';
import { S3ModelService, S3ModelConfig } from '@travetto/model-s3';

class AppConfig {
  @InjectableFactory()
  static getSource(cfg: S3ModelConfig) {
    return new S3ModelService(cfg);
  }
}