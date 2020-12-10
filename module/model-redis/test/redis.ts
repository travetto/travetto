// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { RedisModelService, RedisModelConfig } from '..';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

class Config {
  @InjectableFactory(AuthModelSymbol)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisAuthModelSuite extends AuthModelServiceSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}