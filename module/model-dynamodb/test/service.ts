import { Suite } from '@travetto/test';
import { DynamoDBModelConfig, DynamoDBModelService } from '@travetto/model-dynamodb';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

@Suite()
class DynamoDBBasicSuite extends ModelBasicSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
class DynamoDBCrudSuite extends ModelCrudSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
class DynamoDBExpirySuite extends ModelExpirySuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
class DynamoDBIndexedSuite extends ModelIndexedSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}

@Suite()
class DynamoDBPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
