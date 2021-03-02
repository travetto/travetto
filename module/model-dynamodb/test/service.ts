import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { DynamoDBModelConfig, DynamoDBModelService } from '..';

@Suite()
export class DynamoDBBasicSuite extends ModelBasicSuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}

@Suite()
export class DynamoDBCrudSuite extends ModelCrudSuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}

@Suite()
export class DynamoDBExpirySuite extends ModelExpirySuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}

@Suite()
export class DynamoDBIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}

@Suite()
export class DynamoDBPolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}
