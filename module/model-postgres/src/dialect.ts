import { AbstractANSI99Dialect, type ResolvedPathContext, type TableContext } from '@travetto/model-sql';
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

  override getUpsertSQL(
    context: TableContext,
    columns: string[],
    placeholders: string[],
    conflictTarget: string[],
    updates: string[]
  ): string {
    return `INSERT INTO ${this.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

  #buildContainmentPayload(value: unknown, context: ResolvedPathContext): unknown {
    if (!context.subPath || context.subPath.length === 0) {
      return Array.isArray(value) ? value : [value];
    }

    const subPathMetadata = this.getSchemaSubPathMetadata(context.arrayField?.type, context.subPath);
    const isArraySegment = subPathMetadata.map(item => item.isArray);

    const buildPayloadForValue = (item: unknown): unknown => {
      let itemPayload: unknown = item;
      for (let index = context.subPath!.length - 1; index >= 0; index--) {
        const segment = context.subPath![index];
        if (isArraySegment[index]) {
          itemPayload = { [segment]: Array.isArray(itemPayload) ? itemPayload : [itemPayload] };
        } else {
          itemPayload = { [segment]: itemPayload };
        }
      }
      return itemPayload;
    };

    let currentPayload: unknown;
    if (Array.isArray(value)) {
      currentPayload = value.map(item => buildPayloadForValue(item));
    } else {
      currentPayload = [buildPayloadForValue(value)];
    }

    if (context.arrayPath && context.arrayPath.length > 1) {
      for (let index = context.arrayPath.length - 1; index >= 1; index--) {
        currentPayload = { [context.arrayPath[index]]: currentPayload };
      }
      return currentPayload;
    }

    return currentPayload;
  }

  #getPostgresArrayTarget(context: ResolvedPathContext): {
    isNative: boolean;
    sqlPath: string;
    jsonbPath: string;
    buildPayload: (val: unknown) => unknown;
  } {
    const arrayField = context.arrayField ?? context.leafField;
    const isTopLevel = (context.arrayPath?.length ?? 1) === 1;
    const hasSubPath = (context.subPath?.length ?? 0) > 0;
    const isScalarArray = arrayField ? !SchemaRegistryIndex.has(arrayField.type) : true;
    const isNative = isTopLevel && !hasSubPath && isScalarArray;

    const targetPath =
      hasSubPath && context.arrayPath && context.arrayPath.length > 0 ? this.escapeIdentifier(context.arrayPath[0]) : context.sqlPath;

    const jsonbPath = isTopLevel && !hasSubPath ? targetPath : `(${targetPath})::jsonb`;
    const buildPayload = (value: unknown): unknown => this.#buildContainmentPayload(value, context);

    return { isNative, sqlPath: context.sqlPath, jsonbPath, buildPayload };
  }

  compileArrayAll(context: ResolvedPathContext, identifier: string, value: unknown[]): { sql: string; formatted: unknown } {
    const target = this.#getPostgresArrayTarget(context);
    if (target.isNative) {
      return { sql: `${target.sqlPath} @> ${identifier}`, formatted: value };
    }
    return { sql: `${target.jsonbPath} @> ${identifier}::jsonb`, formatted: JSONUtil.toUTF8(target.buildPayload(value)) };
  }

  compileArrayEquals(context: ResolvedPathContext, identifier: string, values: unknown): { sql: string; formatted: unknown } {
    const target = this.#getPostgresArrayTarget(context);
    if (target.isNative) {
      if (Array.isArray(values)) {
        return { sql: `${target.sqlPath} @> ${identifier}`, formatted: values };
      }
      return { sql: `${identifier} = ANY(${target.sqlPath})`, formatted: values };
    }
    return { sql: `${target.jsonbPath} @> ${identifier}::jsonb`, formatted: JSONUtil.toUTF8(target.buildPayload(values)) };
  }

  compileArrayAny(context: ResolvedPathContext, identifier: string, values: unknown[]): { sql: string; formatted: unknown } {
    const target = this.#getPostgresArrayTarget(context);
    if (target.isNative) {
      return { sql: `${target.sqlPath} && ${identifier}`, formatted: values };
    }
    const formatted = values.map(v => JSONUtil.toUTF8(target.buildPayload(v)));
    return { sql: `${target.jsonbPath} @> ANY(${identifier}::jsonb[])`, formatted };
  }

  compileArrayExists(context: ResolvedPathContext, identifier?: string): { sql: string } {
    const target = this.#getPostgresArrayTarget(context);
    if (target.isNative) {
      return { sql: `(${target.sqlPath} IS NOT NULL AND cardinality(${target.sqlPath}) > 0)` };
    }
    return { sql: `(${target.jsonbPath} IS NOT NULL AND ${target.jsonbPath} <> '[]'::jsonb)` };
  }

  compileArrayRegex(context: ResolvedPathContext, identifier: string, value: RegExp | string): { sql: string; formatted: unknown } {
    const target = this.#getPostgresArrayTarget(context);
    const regex = value instanceof RegExp ? value : new RegExp(String(value));
    const caseInsensitive = regex.flags.includes('i');
    const regexOp = this.getRegexOperator(caseInsensitive);
    const regexSource = this.formatRegex(regex.source, caseInsensitive);

    if (target.isNative) {
      return {
        sql: `EXISTS (SELECT 1 FROM unnest(${target.sqlPath}) AS elem WHERE elem ${regexOp} ${identifier})`,
        formatted: regexSource
      };
    }

    const subAccessor =
      context.subPath && context.subPath.length > 0
        ? `->${context.subPath.map(segment => `'${this.escapeLiteral(segment)}'`).join('->')}`
        : '';

    return {
      sql: `EXISTS (SELECT 1 FROM jsonb_array_elements_text((${target.jsonbPath})${subAccessor}) AS elem WHERE elem ${regexOp} ${identifier})`,
      formatted: regexSource
    };
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
    /* cspell:disable */
    return {
      sql: `SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND c.relkind = 'r'
      );`,
      parameters: [context.tableName]
    };
    /* cspell:enable */
  }

  parseTableExistsResult(records: unknown[]): boolean {
    return castTo<{ exists: boolean }>(records[0])?.exists ?? false;
  }

  getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    /* cspell:disable */
    return {
      sql: `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_catalog.pg_attribute a
       WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;`,
      parameters: [context.tableName]
    };
    /* cspell:enable */
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
    /* cspell:disable */
    return {
      sql: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;`,
      parameters: [context.tableName]
    };
    /* cspell:enable */
  }

  parseExistingIndexes(records: unknown[]): Map<string, string> {
    /* cspell:disable */
    return new Map(
      castTo<{ indexname: string; indexdef: string }[]>(records)
        .filter(record => !record.indexname.endsWith('_pkey'))
        .map(record => [record.indexname, record.indexdef])
    );
    /* cspell:enable */
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
