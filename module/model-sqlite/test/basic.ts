import assert from 'node:assert';

import { Model } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@Model('sqlite_temp_person')
class SqliteTempPerson {
  id: string;
}

@WithSuiteContext()
@Suite()
class SqliteBasicSuite extends ModelBasicSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;

  @Test('truncateModel should fail when underlying table does not exist')
  async testTruncateModelNotExists() {
    const service = await this.service;
    await service.deleteModel(SqliteTempPerson);
    // deleteModel should be idempotent and not throw when table does not exist
    await service.deleteModel(SqliteTempPerson);
    // truncateModel must throw when table does not exist
    await assert.rejects(() => service.truncateModel(SqliteTempPerson));
    await service.upsertModel(SqliteTempPerson);
  }
}

@WithSuiteContext()
@Suite()
class SqliteCrudSuite extends ModelCrudSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteBulkSuite extends ModelBulkSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteExpirySuite extends ModelExpirySuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
