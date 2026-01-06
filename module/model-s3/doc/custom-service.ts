import { InjectableFactory } from '@travetto/di';
import { type S3ModelConfig, S3ModelService } from '@travetto/model-s3';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}
