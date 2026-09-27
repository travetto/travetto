import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { WithNestedLists } from '@travetto/model-query/support/test/model.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQuerySuite extends ModelQuerySuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
  supportsGeo = false;

  @Test('verify postgres scalar list operators: $all, $in, $ne, $eq, $exists')
  async testPostgresScalarListOperators() {
    const service = await this.service;

    await service.create(WithNestedLists, {
      tags: ['red', 'blue', 'green'],
      names: ['alice', 'bob']
    });

    await service.create(WithNestedLists, {
      tags: ['red', 'yellow'],
      names: ['charlie']
    });

    await service.create(WithNestedLists, {
      tags: ['blue'],
      names: ['alice', 'david']
    });

    await service.create(WithNestedLists, {
      tags: [],
      names: []
    });

    // $all test
    const allRedBlue = await service.query(WithNestedLists, {
      where: {
        tags: { $all: ['red', 'blue'] }
      }
    });
    assert(allRedBlue.length === 1);
    assert(allRedBlue[0].names?.includes('alice'));

    // $in test
    const inYellowBlue = await service.query(WithNestedLists, {
      where: {
        tags: { $in: ['yellow', 'blue'] }
      }
    });
    assert(inYellowBlue.length === 3);

    // $ne test
    const neRed = await service.query(WithNestedLists, {
      where: {
        tags: { $ne: 'red' }
      }
    });
    assert(neRed.length === 2);

    // $eq test (single element containment)
    const eqGreen = await service.query(WithNestedLists, {
      where: {
        tags: 'green'
      }
    });
    assert(eqGreen.length === 1);

    // $exists test
    const existsTags = await service.countByQuery(WithNestedLists, {
      where: {
        tags: { $exists: true }
      }
    });
    assert(existsTags === 3);
  }
}
