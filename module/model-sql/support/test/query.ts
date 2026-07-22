import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import { Registry } from '@travetto/registry';
import type { Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { AbstractANSI99Dialect } from '../../src/dialect.ts';
import { SQLQueryCompiler } from '../../src/query.ts';
import type { TableContext } from '../../src/types.ts';
import { SQLModelUtil } from '../../src/util.ts';

@Model()
class User {
  id: string;
  name: string;
}

@Schema()
class Nested {
  value: string;
}

@Model()
class WhereType {
  id: string;
  name: string;
  age: number;
  nestedList: Nested[];
  nestedObj: Nested;
}

// @ts-expect-error
class MockDialect extends AbstractANSI99Dialect {
  complexColumnType = 'TEXT';

  getColumnType() {
    return 'TEXT';
  }

  compileJsonIndexPath(columnName: string, jsonPath: string[]): string {
    return `${columnName}->'${jsonPath.join("->'")}'`;
  }

  override getPlaceholder(index: number) {
    return `$$${index}`;
  }

  compileArrayContains(sqlPath: string, identifier: string) {
    return `${sqlPath} CONTAINING ${identifier}`;
  }

  getRegexOperator(caseInsensitive: boolean) {
    return caseInsensitive ? '~*' : '~';
  }

  formatRegex(source: string) {
    return source;
  }

  castColumn(sqlPath: string, type: unknown) {
    if (type === Number) {
      return `CAST(${sqlPath} AS NUMERIC)`;
    }
    return sqlPath;
  }

  async getTableExists(): Promise<boolean> {
    return true;
  }

  async getExistingColumns(): Promise<Map<string, string>> {
    return new Map();
  }

  async getExistingIndexes(): Promise<Map<string, string>> {
    return new Map();
  }

  async dropIndex(): Promise<void> {}
}

const mockDialect = new MockDialect();

function getMockContext<T extends ModelType>(cls: Class<T>): TableContext<T> {
  return {
    tableName: cls.name.toLowerCase(),
    database: 'test',
    escapedTableName: `"${cls.name.toLowerCase()}"`,
    ...SQLModelUtil.getSchemaContext(cls)
  };
}

@Suite()
export class SQLQueryCompilerTest {
  @BeforeAll()
  async setup() {
    await Registry.init();
  }

  @Test()
  async testCompileSimple() {
    const context = getMockContext(User);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, { name: 'john' });
    assert(whereSQL === '"name" = $$1');
    assert.deepStrictEqual(parameters, ['john']);
  }

  @Test()
  async testCompileOperators() {
    const context = getMockContext(WhereType);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, {
      age: { $gt: 18, $lte: 100 }
    });
    assert(whereSQL === '("age" > $$1 AND "age" <= $$2)');
    assert.deepStrictEqual(parameters, [18, 100]);
  }

  @Test()
  async testCompileNested() {
    const context = getMockContext(WhereType);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, {
      nestedObj: { value: 'test' }
    });
    assert(whereSQL === '"nestedObj"->\'value\' = $$1');
    assert.deepStrictEqual(parameters, ['test']);
  }
}
