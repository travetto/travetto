// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test-support/service';

import { RedisModelConfig, RedisModelService } from '..';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}