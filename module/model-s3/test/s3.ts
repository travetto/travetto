// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { S3ModelConfig, S3ModelService } from '..';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}


@Suite()
export class S3AuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(S3ModelService, S3ModelConfig);
  }
}