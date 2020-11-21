import { Suite } from '@travetto/test';
import { DynamoDBModelConfig, DynamoDBModelService } from '..';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelExpirySuite } from '@travetto/model-core/test/lib/expiry';
import { ModelIndexedSuite } from '@travetto/model-core/test/lib/indexed';

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

