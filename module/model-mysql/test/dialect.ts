import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import type { TableContext } from '@travetto/model-sql';
import { SQLModelSchemaUtil } from '@travetto/model-sql';
import type { Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { BaseSQLDialectSuite } from '@travetto/model-sql/support/test/dialect.ts';

import { MysqlDialect } from '../src/dialect.ts';

@Schema()
class ChildItem {
  name: string;
  age: number;
}

@Model('mysql_gap_parent')
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
export class MysqlDialectSuite extends BaseSQLDialectSuite {
  dialect = new MysqlDialect();

  @Test()
  async testMysqlPathResolution() {
    const tableContext = getTableContext(ParentModel);
    const mysqlAgeResolved = this.dialect.resolvePath(tableContext, ['child', 'age'], 'read');
    assert(mysqlAgeResolved.sqlPath === "CAST(`child`->>'$.age' AS DECIMAL)");

    const mysqlNameResolved = this.dialect.resolvePath(tableContext, ['child', 'name'], 'read');
    assert(mysqlNameResolved.sqlPath === "(CAST(`child`->>'$.name' AS CHAR(255)) COLLATE utf8mb4_bin)");
  }

  @Test()
  async testMysqlCreateIndex() {
    const tableContext = getTableContext(ParentModel);
    const mysqlCreateIndexSql = this.dialect.getCreateIndexSQL(tableContext, {
      type: 'query',
      name: 'child_age',
      class: ParentModel,
      fields: [{ child: { age: 1 } }]
    });
    assert(mysqlCreateIndexSql.includes("(CAST(`child`->>'$.age' AS DECIMAL))"));
  }

  @Test()
  async testMysqlExistingIndexesParsing() {
    const existingIndexRecords = [
      {
        name: 'idx_parentmodel_child_age',
        tableName: 'parentModel',
        nonUnique: 1,
        indexColumns: "(CAST(`child`->>'$.age' AS DECIMAL))"
      }
    ];

    const parsedIndexes = this.dialect.parseExistingIndexes(existingIndexRecords);
    assert(parsedIndexes.size === 1);
    assert(parsedIndexes.has('idx_parentmodel_child_age'));

    const indexDefinition = parsedIndexes.get('idx_parentmodel_child_age')!;
    assert(indexDefinition.includes('CREATE INDEX `idx_parentmodel_child_age` ON `parentModel`'));
    assert(indexDefinition.includes("(CAST(`child`->>'$.age' AS DECIMAL))"));

    const normalizedDefinition = this.dialect.normalizeIndexDefinition(indexDefinition);
    assert(normalizedDefinition.length > 0);
  }

  @Test()
  async testMysqlAlterColumnType() {
    const tableContext = getTableContext(ParentModel);
    const alterColumnSql = this.dialect.getAlterColumnTypeSQL(tableContext, 'title', 'VARCHAR(255)', 'INT');
    assert(alterColumnSql === 'ALTER TABLE `parentmodel` MODIFY COLUMN `title` VARCHAR(255);');

    const noopAlterColumnSql = this.dialect.getAlterColumnTypeSQL(tableContext, 'title', 'VARCHAR(255)', 'VARCHAR(255)');
    assert(noopAlterColumnSql === undefined);
  }
}
