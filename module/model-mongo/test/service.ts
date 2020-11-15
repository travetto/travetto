import { Suite } from '@travetto/test';
import { MongoModelConfig, MongoModelService } from '..';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelStreamSuite } from '@travetto/model-core/test/lib/stream';
import { ModelBulkSuite } from '@travetto/model-core/test/lib/bulk';

@Suite()
export class MongoCrudSuite extends ModelCrudSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoStreamSuite extends ModelStreamSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoBulkSuite extends ModelBulkSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}