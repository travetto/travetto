// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

import { MongoModelConfig, MongoModelService } from '../..';

class Init {
  @InjectableFactory(AuthModelSymbol)
  static modelProvider(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}


@Suite()
export class MongoAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}