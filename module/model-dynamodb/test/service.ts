import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

import { DynamoDBModelConfig, DynamoDBModelService } from '..';

@Suite()
export class DynamoDBBasicSuite extends ModelBasicSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
export class DynamoDBCrudSuite extends ModelCrudSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
export class DynamoDBExpirySuite extends ModelExpirySuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
export class DynamoDBIndexedSuite extends ModelIndexedSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
export class DynamoDBPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
