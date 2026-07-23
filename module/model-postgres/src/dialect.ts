import { AbstractANSI99Dialect, type TableContext } from '@travetto/model-sql';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export class PostgresDialect extends AbstractANSI99Dialect {
  returningSupport = true;
  suggestLikeOperator = 'ILIKE';

  getComplexColumnType(field: SchemaFieldConfig): string {
    if (field.array && !SchemaRegistryIndex.has(field.type)) {
      const scalarType = this.getColumnType(field);
      return `${scalarType}[]`;
    }
    return 'JSONB';
  }

  getComplexColumnValue(field: SchemaFieldConfig, value: unknown): unknown {
    if (field.array && !SchemaRegistryIndex.has(field.type)) {
      return value ?? null;
    }
    return super.getComplexColumnValue(field, value);
  }

  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
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
    return `((${columnName}${jsonAccessor}->>'${this.escapeLiteral(leafSegment)}'))`;
  }

  override getPlaceholder(index: number): string {
    return `$${index}`;
  }

  compileArrayAll(
    sqlPath: string,
    identifier: string,
    value: unknown[],
    field: SchemaFieldConfig,
    topLevel?: boolean
  ): { sql: string; formatted: unknown } {
    if (topLevel && !SchemaRegistryIndex.has(field.type)) {
      return { sql: `${sqlPath} @> ${identifier}`, formatted: value };
    }
    return { sql: `${sqlPath} @> ${identifier}::jsonb`, formatted: JSONUtil.toUTF8(value) };
  }

  compileArrayEquals(
    sqlPath: string,
    identifier: string,
    values: unknown,
    field: SchemaFieldConfig,
    topLevel?: boolean
  ): { sql: string; formatted: unknown } {
    if (topLevel && !SchemaRegistryIndex.has(field.type)) {
      if (Array.isArray(values)) {
        return { sql: `${sqlPath} @> ${identifier}`, formatted: values };
      }
      return { sql: `${identifier} = ANY(${sqlPath})`, formatted: values };
    }
    const val = Array.isArray(values) ? values : [values];
    return { sql: `${sqlPath} @> ${identifier}::jsonb`, formatted: JSONUtil.toUTF8(val) };
  }

  compileArrayAny(
    sqlPath: string,
    identifier: string,
    values: unknown[],
    field: SchemaFieldConfig,
    topLevel?: boolean
  ): { sql: string; formatted: unknown } {
    if (topLevel && !SchemaRegistryIndex.has(field.type)) {
      return { sql: `${sqlPath} && ${identifier}`, formatted: values };
    }
    const formatted = values.map(v => JSONUtil.toUTF8(Array.isArray(v) ? v : [v]));
    return { sql: `${sqlPath} @> ANY(${identifier}::jsonb[])`, formatted };
  }

  compileArrayExists(sqlPath: string, identifier: string, field: SchemaFieldConfig, topLevel?: boolean): { sql: string } {
    if (topLevel && !SchemaRegistryIndex.has(field.type)) {
      return { sql: `(${sqlPath} IS NOT NULL AND cardinality(${sqlPath}) > 0)` };
    }
    return { sql: `(${sqlPath} IS NOT NULL AND ${sqlPath} <> ${identifier}::jsonb)` };
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

  getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND c.relkind = 'r'
      );`,
      parameters: [context.tableName]
    };
  }

  parseTableExistsResult(records: unknown[]): boolean {
    return castTo<{ exists: boolean }>(records[0])?.exists ?? false;
  }

  getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_catalog.pg_attribute a
       WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;`,
      parameters: [context.tableName]
    };
  }

  parseExistingColumns(records: unknown[]): Map<string, string> {
    return new Map(castTo<{ name: string; type: string }[]>(records).map(record => [record.name, record.type.toUpperCase()]));
  }

  getAlterColumnTypeSQL(context: TableContext, columnName: string, columnType: string, existingType: string): string | undefined {
    const normalizedExisting = existingType.replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');
    const normalizedRequested = columnType.toUpperCase().replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');

    if (!normalizedExisting.startsWith(normalizedRequested) && !normalizedRequested.startsWith(normalizedExisting)) {
      return `ALTER TABLE ${this.escapeIdentifier(context.tableName)} ALTER COLUMN ${this.escapeIdentifier(columnName)} TYPE ${columnType} USING (${this.escapeIdentifier(columnName)}::${columnType});`;
    }
    return undefined;
  }

  getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;`,
      parameters: [context.tableName]
    };
  }

  parseExistingIndexes(records: unknown[]): Map<string, string> {
    return new Map(
      castTo<{ indexname: string; indexdef: string }[]>(records)
        .filter(record => !record.indexname.endsWith('_pkey'))
        .map(record => [record.indexname, record.indexdef])
    );
  }

  getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`;
  }

  getDropTableSQL(context: TableContext): string {
    return `DROP TABLE IF EXISTS ${this.escapeIdentifier(context.tableName)} CASCADE;`;
  }

  getTruncateTableSQL(context: TableContext): string {
    return `TRUNCATE TABLE ${this.escapeIdentifier(context.tableName)} CASCADE;`;
  }
}
