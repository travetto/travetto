import type { IndexConfig, ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

export type JSONSqlPathMode = 'orderBy' | 'createIndex' | 'read';

/**
 * Interface representing SQL Dialect-specific generation hooks and behaviors
 */
export interface SQLDialect {
  /**
   * The configuration containing connection information and namespace details
   */
  readonly config: { namespace: string };

  /**
   * Escapes a database SQL identifier (like a table or column name)
   */
  escapeIdentifier(name: string): string;

  /**
   * Escapes a database SQL string literal
   */
  escapeLiteral(value: string): string;

  /**
   * Maps a schema field config to its corresponding SQL column data type
   */
  getColumnType(fieldConfiguration: SchemaFieldConfig): string;

  /**
   * Compiles an index path (e.g. ['parent', 'child', 'value']) into its SQL expression
   */
  compileIndexPath(context: TableContext<ModelType>, path: string[], mode: JSONSqlPathMode): string;

  /**
   * Generates the CREATE INDEX statement for a model index
   */
  getCreateIndexSQL(context: TableContext<ModelType>, indexConfig: IndexConfig): string;

  /**
   * Generates parameter placeholder character based on index (e.g., $1, $2 for Postgres, ? for MySQL/SQLite)
   */
  getPlaceholder(index: number): string;

  /**
   * Compiles JSON array containment query operator
   * E.g., Postgres: `${sqlPath} @> ${ident}::jsonb`
   * MySQL: `JSON_CONTAINS(${sqlPath}, ${ident})`
   * SQLite: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${ident})` : ident})`
   */
  compileArrayContains(sqlPath: string, ident: string, isObject: boolean, type?: Class): string;
  compileJsonEquality?(sqlPath: string, ident: string): string;
  /**
   * Database-specific regex operator (e.g., '~*' for Postgres case-insensitive, 'REGEXP' for MySQL/SQLite)
   */
  getRegexOperator(caseInsensitive: boolean): string;

  /**
   * Optional custom formatting of regex source pattern (e.g. Postgres regex word boundaries)
   */
  formatRegex(source: string, caseInsensitive: boolean): string;

  /**
   * Database-specific type casting syntax (e.g., `(path)::NUMERIC` vs `CAST(path AS DECIMAL)`)
   */
  castColumn(sqlPath: string, type: Class): string;

  /**
   * Compiles custom conflict target/upsert SQL syntax.
   * E.g., Postgres: INSERT INTO ... ON CONFLICT (id) DO UPDATE SET ...
   * MySQL: INSERT INTO ... ON DUPLICATE KEY UPDATE ...
   */
  getUpsertSQL(
    context: TableContext<ModelType>,
    columns: string[],
    placeholders: string[],
    conflictTarget: string[],
    updates: string[]
  ): string;

  /**
   * Shifts placeholder numbers if needed (e.g., PostgreSQL shifting $1 to $3)
   */
  shiftPlaceholders?(sql: string, offset: number): string;

  /**
   * Database-specific suggest prefix match operator (e.g., 'ILIKE' for Postgres, defaulting to 'LIKE')
   */
  suggestLikeOperator?: string;

  /**
   * Schema synchronization: creates table if it does not exist, alters columns, syncs indexes
   */
  upsertTable(modelClass: Class<ModelType>): Promise<void>;

  /**
   * Schema synchronization: drops the table
   */
  dropTable(modelClass: Class<ModelType>): Promise<void>;

  /**
   * Truncates table cascade
   */
  truncateTable(modelClass: Class<ModelType>): Promise<void>;
}

export interface SchemaContext<T> {
  cls: Class<T>;
  simpleFields: Map<string, SchemaFieldConfig>;
  complexFields: Map<string, SchemaFieldConfig>;
  allFields: SchemaFieldConfig[];
}

export interface TableContext<T extends ModelType> extends SchemaContext<T> {
  tableName: string;
  escapedTableName: string;
  dialect: SQLDialect;
}
