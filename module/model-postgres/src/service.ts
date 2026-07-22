import type { default as pg } from 'pg';

import { Injectable, PostConstruct } from '@travetto/di';
import { BaseSQLModelService, type TableContext } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { PostgresConnection } from './connection.ts';

/**
 * A PostgreSQL JSON-based document store model service
 */
@Injectable()
export class PostgresModelService extends BaseSQLModelService {
  connection: PostgresConnection;
  suggestLikeOperator = 'ILIKE';
  returningSupport = true;
  complexColumnType = 'JSONB';

  constructor(connection: PostgresConnection) {
    super();
    this.connection = connection;
  }

  get client(): pg.Pool {
    return this.connection.pool;
  }

  get config() {
    return this.connection.config;
  }

  // Dialect hooks
  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
    if (SchemaRegistryIndex.has(fieldConfiguration.type) || fieldConfiguration.array) {
      return 'JSONB';
    }

    if (fieldConfiguration.type === castTo(BigInt)) {
      return 'BIGINT';
    }

    if (fieldConfiguration.type === Number) {
      if (fieldConfiguration.precision) {
        const [digits, decimals] = fieldConfiguration.precision;
        if (decimals) {
          return `DECIMAL(${digits},${decimals})`;
        }
        if (digits < 5) {
          return 'SMALLINT';
        }
        if (digits < 10) {
          return 'INTEGER';
        }
        return 'BIGINT';
      }
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Date) {
      return 'TIMESTAMP(6) WITH TIME ZONE';
    }

    if (fieldConfiguration.type === Boolean) {
      return 'BOOLEAN';
    }

    if (fieldConfiguration.type === String) {
      if (fieldConfiguration.specifiers?.includes('text')) {
        return 'TEXT';
      }
      return `VARCHAR(${fieldConfiguration.maxlength?.limit ?? 1024})`;
    }

    return 'JSONB';
  }

  compileJsonIndexPath(columnName: string, jsonPath: string[]): string {
    const jsonAccessor = jsonPath
      .slice(0, -1)
      .map(segment => `->'${this.escapeLiteral(segment)}'`)
      .join('');
    const leafSegment = jsonPath[jsonPath.length - 1];
    // Surround with extra parentheses as required by Postgres for expression indexes
    return `((${columnName}${jsonAccessor}->>'${this.escapeLiteral(leafSegment)}'))`;
  }

  getPlaceholder(index: number): string {
    return `$${index}`;
  }

  compileArrayContains(sqlPath: string, ident: string, isObject: boolean, type?: Class): string {
    if (isObject) {
      return `${sqlPath} @> ${ident}::jsonb`;
    }
    let cast = 'text';
    if (type === Number) {
      cast = 'numeric';
    } else if (type === Boolean) {
      cast = 'boolean';
    } else if (type === Date) {
      cast = 'timestamp with time zone';
    }
    return `${sqlPath} @> jsonb_build_array(${ident}::${cast})`;
  }

  getRegexOperator(caseInsensitive: boolean): string {
    return caseInsensitive ? '~*' : '~';
  }

  formatRegex(source: string, caseInsensitive: boolean): string {
    return source.replaceAll('\\b', '\\y');
  }

  castColumn(sqlPath: string, type: Class): string {
    if (type === Number) {
      return `(${sqlPath})::NUMERIC`;
    } else if (type === Boolean) {
      return `(${sqlPath})::BOOLEAN`;
    } else if (type === Date) {
      return `(${sqlPath})::TIMESTAMP WITH TIME ZONE`;
    } else if (type === String) {
      return `(${sqlPath})::text`;
    }
    return sqlPath;
  }

  shiftPlaceholders(sql: string, offset: number): string {
    return sql.replaceAll(/[$](\d+)/g, (_, num) => `$${Number(num) + offset}`);
  }

  async getTableExists(context: TableContext): Promise<boolean> {
    const tableCheck = await this.connection.execute<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND c.relkind = 'r'
      );`,
      [context.tableName]
    );
    return tableCheck.records[0]?.exists ?? false;
  }

  async getExistingColumns(context: TableContext): Promise<Map<string, string>> {
    const columnQuery = await this.connection.execute<{ name: string; type: string }>(
      `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_catalog.pg_attribute a
       WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;`,
      [context.tableName]
    );
    return new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));
  }

  async handleColumnTypeMismatch(context: TableContext, columnName: string, columnType: string, existingType: string): Promise<void> {
    const normalizedExisting = existingType.replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');
    const normalizedRequested = columnType.toUpperCase().replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');

    if (!normalizedExisting.startsWith(normalizedRequested) && !normalizedRequested.startsWith(normalizedExisting)) {
      const alterColumnSQL = `ALTER TABLE ${context.escapedTableName} ALTER COLUMN ${this.escapeIdentifier(columnName)} TYPE ${columnType} USING (${this.escapeIdentifier(columnName)}::${columnType});`;
      await this.connection.execute(alterColumnSQL);
    }
  }

  async getExistingIndexes(context: TableContext): Promise<Map<string, string>> {
    const indexQuery = await this.connection.execute<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;`,
      [context.tableName]
    );
    return new Map(
      indexQuery.records.filter(record => !record.indexname.endsWith('_pkey')).map(record => [record.indexname, record.indexdef])
    );
  }

  async dropIndex(context: TableContext, indexName: string): Promise<void> {
    await this.connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
  }

  override async dropTable(context: TableContext): Promise<void> {
    await this.connection.execute(`DROP TABLE IF EXISTS ${context.escapedTableName} CASCADE;`);
  }

  async truncateTable(context: TableContext): Promise<void> {
    await this.connection.execute(`TRUNCATE TABLE ${context.escapedTableName} CASCADE;`);
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
