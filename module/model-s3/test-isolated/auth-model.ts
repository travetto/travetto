// @file-if @travetto/auth
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '@travetto/auth/test-support/model';

import { S3ModelConfig, S3ModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3AuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}