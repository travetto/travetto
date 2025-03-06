import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3AuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}
