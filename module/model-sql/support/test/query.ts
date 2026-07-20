import assert from 'node:assert';

import { Schema } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import type { SQLDialect } from '../../src/dialect.ts';
import { SQLQueryCompiler } from '../../src/query.ts';
import { SQLModelUtil } from '../../src/util.ts';

@Schema()
class User {
  id: string;
  name: string;
}

@Schema()
class Nested {
  value: string;
}

@Schema()
class WhereType {
  id: string;
  name: string;
  age: number;
  nestedList: Nested[];
  nestedObj: Nested;
}

const mockDialect: SQLDialect = {
  config: { namespace: '' },
  escapeIdentifier(name: string) {
    return `"${name}"`;
  },
  escapeLiteral(value: string) {
    return `'${value}'`;
  },
  getColumnType() {
    return 'TEXT';
  },
  compileIndexPath(tableName, simpleFields, path) {
    // Basic mock path resolution
    const first = path[0];
    const rest = path.slice(1);
    if (rest.length === 0) {
      return `"${first}"`;
    }
    return `"${first}"->'${rest.join("->'")}'`;
  },
  getCreateIndexSQL() {
    return '';
  },
  getPlaceholder(index) {
    return `$$${index}`;
  },
  compileArrayContains(sqlPath, ident) {
    return `${sqlPath} CONTAINING ${ident}`;
  },
  getRegexOperator(caseInsensitive) {
    return caseInsensitive ? '~*' : '~';
  },
  formatRegex(source) {
    return source;
  },
  castColumn(sqlPath, type) {
    if (type === Number) {
      return `CAST(${sqlPath} AS NUMERIC)`;
    }
    return sqlPath;
  },
  getUpsertSQL() {
    return '';
  },
  async upsertTable() {},
  async dropTable() {},
  async truncateTable() {}
};

@Suite()
export class SQLQueryCompilerTest {
  @Test()
  async testCompileSimple() {
    const context = SQLModelUtil.getContext(mockDialect, User);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, { name: 'john' });
    assert(whereSQL === '"name" = $$1');
    assert.deepStrictEqual(parameters, ['john']);
  }

  @Test()
  async testCompileOperators() {
    const context = SQLModelUtil.getContext(mockDialect, WhereType);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, {
      age: { $gt: 18, $lte: 100 }
    });
    assert(whereSQL === '("age" > $$1 AND "age" <= $$2)');
    assert.deepStrictEqual(parameters, [18, 100]);
  }

  @Test()
  async testCompileNested() {
    const context = SQLModelUtil.getContext(mockDialect, WhereType);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(mockDialect, context, {
      nestedObj: { value: 'test' }
    });
    assert(whereSQL === '"nestedObj"->\'value\' = $$1');
    assert.deepStrictEqual(parameters, ['test']);
  }
}
