// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { RedisModelConfig, RedisModelService } from '..';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
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