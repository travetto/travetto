import assert from 'node:assert';

import { Model, type ModelType, TransientField } from '@travetto/model';
import { Registry } from '@travetto/registry';
import type { Class } from '@travetto/runtime';
import { Required, Schema } from '@travetto/schema';
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

@Schema()
@Model()
class SimpleModel {
  id: string;
  @Required()
  requiredField: string;
  optionalField?: string;
  @TransientField()
  transientField: string;
}

@Schema()
@Model({ discriminator: 'type' })
abstract class BasePolymorphic {
  id: string;
  type: string;
  @Required()
  sharedRequired: string;
}

@Schema()
@Model()
class SubTypeA extends BasePolymorphic {
  @Required()
  subTypeAOnlyRequired: string;
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
    SQLModelSchemaUtil.SCHEMA_CACHE.clear();
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

  @Test('Verify DDL column nullability across dialects')
  async testDDLNullabilityParity() {
    SQLModelSchemaUtil.SCHEMA_CACHE.clear();
    const simpleContext = getTableContext(SimpleModel);
    const polyContext = getTableContext(BasePolymorphic);

    const dialects = [
      { instance: new SqliteDialect(), quote: '"' },
      { instance: new PostgresDialect(), quote: '"' },
      { instance: new MysqlDialect(), quote: '`' }
    ];

    for (const { instance, quote } of dialects) {
      const simpleSQL = instance.getCreateTableSQL(simpleContext);
      const requiredLine = simpleSQL.split('\n').find(line => line.includes(`${quote}requiredField${quote}`));
      assert(requiredLine?.includes('NOT NULL'));

      const optionalLine = simpleSQL.split('\n').find(line => line.includes(`${quote}optionalField${quote}`));
      if (optionalLine) {
        assert(!optionalLine.includes('NOT NULL'));
      }

      const transientLine = simpleSQL.split('\n').find(line => line.includes(`${quote}transientField${quote}`));
      if (transientLine) {
        assert(!transientLine.includes('NOT NULL'));
      }

      const polySQL = instance.getCreateTableSQL(polyContext);
      const sharedRequiredLine = polySQL.split('\n').find(line => line.includes(`${quote}sharedRequired${quote}`));
      assert(sharedRequiredLine?.includes('NOT NULL'));

      const subTypeLine = polySQL.split('\n').find(line => line.includes(`${quote}subTypeAOnlyRequired${quote}`));
      if (subTypeLine) {
        assert(!subTypeLine.includes('NOT NULL'));
      }
    }
  }
}
