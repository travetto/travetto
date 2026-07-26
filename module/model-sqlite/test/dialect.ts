import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import type { TableContext } from '@travetto/model-sql';
import { SQLModelSchemaUtil } from '@travetto/model-sql';
import type { Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { BaseSQLDialectSuite } from '@travetto/model-sql/support/test/dialect.ts';

import { SqliteDialect } from '../src/dialect.ts';

@Schema()
class ChildItem {
  name: string;
}

@Model('sqlite_gap_parent')
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
export class SqliteDialectSuite extends BaseSQLDialectSuite {
  dialect = new SqliteDialect();

  @Test()
  async testSqliteArraySubObjectPatch() {
    const tableContext = getTableContext(ParentModel);
    const resolvedContext = this.dialect.resolvePath(tableContext, ['child', 'name'], 'read');
    const { sql } = this.dialect.compileArrayEquals(resolvedContext, '$$1', { name: 'bob' });

    assert(sql.includes('json_patch('));
    assert(sql.includes('= elem.value'));
  }
}
