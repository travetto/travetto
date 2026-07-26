import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import { Registry } from '@travetto/registry';
import type { Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { MysqlDialect } from '../../../model-mysql/src/dialect.ts';
import { PostgresDialect } from '../../../model-postgres/src/dialect.ts';
import { SqliteDialect } from '../../../model-sqlite/src/dialect.ts';
import { SQLModelSchemaUtil } from '../../src/schema.ts';
import type { TableContext } from '../../src/types.ts';

@Schema()
class ChildItem {
  name: string;
  age: number;
  active: boolean;
  createdDate: Date;
}

@Model()
class ParentModel {
  id: string;
  title: string;
  child: ChildItem;
}

function getTableContext<T extends ModelType>(modelClass: Class<T>): TableContext<T> {
  return {
    tableName: modelClass.name.toLowerCase(),
    ...SQLModelSchemaUtil.getSchemaContext(modelClass)
  };
}

@Suite()
export class SQLDialectGapsTest {
  @BeforeAll()
  async setup() {
    await Registry.init();
  }

  @Test()
  async testIndexAndQueryExpressionParity() {
    const tableContext = getTableContext(ParentModel);
    const mysqlDialect = new MysqlDialect();
    const postgresDialect = new PostgresDialect();
    const sqliteDialect = new SqliteDialect();

    // Verify MySQL path resolution matches index creation
    const mysqlAgeResolved = mysqlDialect.resolvePath(tableContext, ['child', 'age'], 'read');
    assert(mysqlAgeResolved.sqlPath === "CAST(`child`->>'$.age' AS DECIMAL)");

    const mysqlNameResolved = mysqlDialect.resolvePath(tableContext, ['child', 'name'], 'read');
    assert(mysqlNameResolved.sqlPath === "(CAST(`child`->>'$.name' AS CHAR(255)) COLLATE utf8mb4_bin)");

    // Verify Postgres path resolution matches index creation
    const postgresAgeResolved = postgresDialect.resolvePath(tableContext, ['child', 'age'], 'read');
    assert(postgresAgeResolved.sqlPath === '((("child"->>\'age\')))::NUMERIC');

    // Verify SQLite path resolution matches index creation
    const sqliteAgeResolved = sqliteDialect.resolvePath(tableContext, ['child', 'age'], 'read');
    assert(sqliteAgeResolved.sqlPath === 'CAST(json_extract("child", \'$.age\') AS NUMERIC)');
  }

  @Test()
  async testSqliteArraySubObjectPatch() {
    const tableContext = getTableContext(ParentModel);
    const sqliteDialect = new SqliteDialect();

    const resolvedContext = sqliteDialect.resolvePath(tableContext, ['child', 'name'], 'read');
    const { sql } = sqliteDialect.compileArrayEquals(resolvedContext, '$$1', { name: 'bob' });

    assert(sql.includes('json_patch('));
    assert(sql.includes('= elem.value'));
  }

  @Test()
  async testCreateIndexes() {
    const tableContext = getTableContext(ParentModel);
    const mysqlDialect = new MysqlDialect();
    const postgresDialect = new PostgresDialect();

    // Verify create index SQL contains the resolved expressions
    const mysqlCreateIndexSql = mysqlDialect.getCreateIndexSQL(tableContext, {
      type: 'query',
      name: 'child_age',
      fields: [{ 'child.age': 1 }]
    });
    assert(mysqlCreateIndexSql.includes("(CAST(`child`->>'$.age' AS DECIMAL))"));

    const postgresCreateIndexSql = postgresDialect.getCreateIndexSQL(tableContext, {
      type: 'query',
      name: 'child_age',
      fields: [{ 'child.age': 1 }]
    });
    assert(postgresCreateIndexSql.includes('((("child"->>\'age\')))::NUMERIC)'));
  }

  @Test()
  async testMysqlExistingIndexesParsing() {
    const mysqlDialect = new MysqlDialect();
    const existingIndexRecords = [
      {
        name: 'idx_parentmodel_child_age',
        tableName: 'parentmodel',
        nonUnique: 1,
        indexColumns: "(CAST(`child`->>'$.age' AS DECIMAL))"
      }
    ];

    const parsedIndexes = mysqlDialect.parseExistingIndexes(existingIndexRecords);
    assert(parsedIndexes.size === 1);
    assert(parsedIndexes.has('idx_parentmodel_child_age'));

    const indexDefinition = parsedIndexes.get('idx_parentmodel_child_age')!;
    assert(indexDefinition.includes('CREATE INDEX `idx_parentmodel_child_age` ON `parentmodel`'));
    assert(indexDefinition.includes("(CAST(`child`->>'$.age' AS DECIMAL))"));

    const normalizedDefinition = mysqlDialect.normalizeIndexDefinition(indexDefinition);
    assert(normalizedDefinition.length > 0);
  }

  @Test()
  async testMysqlAlterColumnType() {
    const tableContext = getTableContext(ParentModel);
    const mysqlDialect = new MysqlDialect();

    const alterColumnSql = mysqlDialect.getAlterColumnTypeSQL(tableContext, 'title', 'VARCHAR(255)', 'INT');
    assert(alterColumnSql === 'ALTER TABLE `parentmodel` MODIFY COLUMN `title` VARCHAR(255);');

    const noopAlterColumnSql = mysqlDialect.getAlterColumnTypeSQL(tableContext, 'title', 'VARCHAR(255)', 'VARCHAR(255)');
    assert(noopAlterColumnSql === undefined);
  }

  @Test()
  async testFormatJsonPathEscaping() {
    const mysqlDialect = new MysqlDialect();

    const simpleJsonPath = mysqlDialect.formatJsonPath(['child', 'age']);
    assert(simpleJsonPath === 'child.age');

    const complexJsonPath = mysqlDialect.formatJsonPath(['child', 'first name']);
    assert(complexJsonPath === 'child."first name"');
  }

  @Test()
  async testPartialUpdateSetsWithoutRegex() {
    const tableContext = getTableContext(ParentModel);
    const sqliteDialect = new SqliteDialect();

    const { sets, values } = sqliteDialect.compilePartialUpdate(tableContext, { title: 'Updated Title' });
    assert.deepStrictEqual(sets, ['"title" = ?']);
    assert.deepStrictEqual(values, ['Updated Title']);
  }
}
