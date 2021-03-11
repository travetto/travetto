// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '@travetto/auth-model/test-support/service';

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