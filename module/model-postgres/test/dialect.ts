import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import type { TableContext } from '@travetto/model-sql';
import { SQLModelSchemaUtil } from '@travetto/model-sql';
import type { Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { BaseSQLDialectSuite } from '@travetto/model-sql/support/test/dialect.ts';

import { PostgresDialect } from '../src/dialect.ts';

@Schema()
class ChildItem {
  age: number;
}

@Model('postgres_gap_parent')
class ParentModel {
  id: string;
  child: ChildItem;
}

function getTableContext<T extends ModelType>(modelClass: Class<T>): TableContext<T> {
  return {
    tableName: modelClass.name.toLowerCase(),
    ...SQLModelSchemaUtil.getSchemaContext(modelClass)
  };
}

@Suite()
export class PostgresDialectSuite extends BaseSQLDialectSuite {
  dialect = new PostgresDialect();

  @Test()
  async testPostgresCreateIndex() {
    const tableContext = getTableContext(ParentModel);
    const postgresCreateIndexSql = this.dialect.getCreateIndexSQL(tableContext, {
      type: 'query',
      name: 'child_age',
      class: ParentModel,
      fields: [{ child: { age: 1 } }]
    });
    assert(postgresCreateIndexSql.includes('((("child"->>\'age\')))::NUMERIC)'));
  }
}
