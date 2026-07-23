import { AbstractANSI99Dialect, type TableContext } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export class PostgresDialect extends AbstractANSI99Dialect {
  override returningSupport = true;
  override suggestLikeOperator = 'ILIKE';
  override complexColumnType = 'JSONB';

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
    return `((${columnName}${jsonAccessor}->>'${this.escapeLiteral(leafSegment)}'))`;
  }

  override getPlaceholder(index: number): string {
    return `$${index}`;
  }

  compileArrayContains(sqlPath: string, identifier: string, isObject: boolean, type?: Class): string {
    if (isObject) {
      return `${sqlPath} @> ${identifier}::jsonb`;
    }
    let cast = 'text';
    if (type === Number) {
      cast = 'numeric';
    } else if (type === Boolean) {
      cast = 'boolean';
    } else if (type === Date) {
      cast = 'timestamp with time zone';
    }
    return `${sqlPath} @> jsonb_build_array(${identifier}::${cast})`;
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
      sql: `
SELECT EXISTS (
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
      sql: `
SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;
`,
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
      return `
ALTER TABLE ${this.escapeIdentifier(context.tableName)} 
ALTER COLUMN ${this.escapeIdentifier(columnName)} TYPE ${columnType} 
USING (${this.escapeIdentifier(columnName)}::${columnType});`;
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
