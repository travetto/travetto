import { InjectableFactory } from '@travetto/di';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: S3ModelConfig) {
    return new S3ModelService(conf);
  }
}
