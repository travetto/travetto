/* eslint-disable @stylistic/indent */
import { DataUtil, type SchemaFieldConfig, SchemaRegistryIndex, type Point } from '@travetto/schema';
import { type Class, AppError, TypedObject, TimeUtil, castTo, castKey, toConcrete, JSONUtil } from '@travetto/runtime';
import { type SelectClause, type Query, type SortClause, type WhereClause, type RetainQueryPrimitiveFields, ModelQueryUtil } from '@travetto/model-query';
import type { BulkResponse, IndexConfig, ModelType } from '@travetto/model';

import { SQLModelUtil } from '../util.ts';
import type { DeleteWrapper, InsertWrapper, DialectState } from '../internal/types.ts';
import type { Connection } from '../connection/base.ts';
import type { VisitStack } from '../types.ts';

const PointConcrete = toConcrete<Point>();

interface Alias {
  alias: string;
  path: VisitStack[];
}

export type SQLTableDescription = {
  columns: { name: string, type: string, is_not_null: boolean }[];
  foreignKeys: { name: string, from_column: string, to_column: string, to_table: string }[];
  indices: { name: string, columns: { name: string, desc: boolean }[], is_unique: boolean }[];
};

function makeField(name: string, type: Class, required: boolean, extra: Partial<SchemaFieldConfig>): SchemaFieldConfig {
  return {
    name,
    class: null!,
    type,
    array: false,
    ...(required ? { required: { active: true } } : {}),
    ...extra
  };
}

/**
 * Base sql dialect
 */
export abstract class SQLDialect implements DialectState {
  /**
   * Default length of unique ids
   */
  ID_LENGTH = 32;

  /**
   * Hash Length
   */
  HASH_LENGTH = 64;

  /**
   * Default length for varchar
   */
  DEFAULT_STRING_LENGTH = 1024;

  /**
   * Mapping between query operators and SQL operations
   */
  SQL_OPS = {
    $and: 'AND',
    $or: 'OR',
    $not: 'NOT',
    $all: '=ALL',
    $regex: undefined,
    $iregex: undefined,
    $in: 'IN',
    $nin: 'NOT IN',
    $eq: '=',
    $ne: '<>',
    $gte: '>=',
    $like: 'LIKE',
    $ilike: 'ILIKE',
    $lte: '<=',
    $gt: '>',
    $lt: '<',
    $is: 'IS',
    $isNot: 'IS NOT'
  };

  /**
   * Column type mapping
   */
  COLUMN_TYPES = {
    JSON: '',
    POINT: 'POINT',
    BOOLEAN: 'BOOLEAN',
    TINYINT: 'TINYINT',
    SMALLINT: 'SMALLINT',
    MEDIUMINT: 'MEDIUMINT',
    INT: 'INT',
    BIGINT: 'BIGINT',
    TIMESTAMP: 'TIMESTAMP',
    TEXT: 'TEXT'
  };

  /**
   * Column types with inputs
   */
  PARAMETERIZED_COLUMN_TYPES: Record<'VARCHAR' | 'DECIMAL', (...values: number[]) => string> = {
    VARCHAR: count => `VARCHAR(${count})`,
    DECIMAL: (digits, precision) => `DECIMAL(${digits},${precision})`
  };

  ID_AFFIX = '`';

  /**
   * Generate an id field
   */
  idField = makeField('id', String, true, {
    maxlength: { limit: this.ID_LENGTH },
    minlength: { limit: this.ID_LENGTH }
  });

  /**
   * Generate an idx field
   */
  idxField = makeField('__idx', Number, true, {});

  /**
   * Parent path reference
   */
  parentPathField = makeField('__parent_path', String, true, {
    maxlength: { limit: this.HASH_LENGTH },
    minlength: { limit: this.HASH_LENGTH },
    required: { active: true }
  });

  /**
   * Path reference
   */
  pathField = makeField('__path', String, true, {
    maxlength: { limit: this.HASH_LENGTH },
    minlength: { limit: this.HASH_LENGTH },
    required: { active: true }
  });

  regexWordBoundary = '\\b';

  rootAlias = '_ROOT';

  aliasCache = new Map<Class, Map<string, Alias>>();
  namespacePrefix: string;

  constructor(namespacePrefix: string) {
    this.namespace = this.namespace.bind(this);
    this.table = this.table.bind(this);
    this.identifier = this.identifier.bind(this);
    this.namespacePrefix = namespacePrefix ? `${namespacePrefix}_` : namespacePrefix;
  }

  /**
   * Get connection
   */
  abstract get connection(): Connection<unknown>;

  /**
   * Hash a value
   */
  abstract hash(input: string): string;

  /**
   * Describe a table structure
   */
  abstract describeTable(table: string): Promise<SQLTableDescription | undefined>;

  executeSQL<T>(sql: string): Promise<{ records: T[], count: number }> {
    return this.connection.execute<T>(this.connection.active, sql);
  }

  /**
   * Identify a name or field (escape it)
   */
  identifier(field: SchemaFieldConfig | string): string {
    if (field === '*') {
      return field;
    } else {
      const name = (typeof field === 'string') ? field : field.name;
      return `${this.ID_AFFIX}${name}${this.ID_AFFIX}`;
    }
  }

  quote(text: string): string {
    return `'${text.replace(/[']/g, "''")}'`;
  }

  /**
   * Resolve date value
   * @param value
   * @returns
   */
  resolveDateValue(value: Date): string {
    const [day, time] = value.toISOString().split(/[TZ]/);
    return this.quote(`${day} ${time}`);
  }

  /**
   * Convert value to SQL valid representation
   */
  resolveValue(config: SchemaFieldConfig, value: unknown): string {
    if (value === undefined || value === null) {
      return 'NULL';
    } else if (config.type === String) {
      if (value instanceof RegExp) {
        const regexSource = DataUtil.toRegex(value).source.replace(/\\b/g, this.regexWordBoundary);
        return this.quote(regexSource);
      } else {
        return this.quote(castTo(value));
      }
    } else if (config.type === Boolean) {
      return `${value ? 'TRUE' : 'FALSE'}`;
    } else if (config.type === castTo(BigInt)) {
      return value.toString();
    } else if (config.type === Number) {
      return `${value}`;
    } else if (config.type === Date) {
      if (typeof value === 'string' && TimeUtil.isTimeSpan(value)) {
        return this.resolveDateValue(TimeUtil.fromNow(value));
      } else {
        return this.resolveDateValue(DataUtil.coerceType(value, Date, true));
      }
    } else if (config.type === PointConcrete && Array.isArray(value)) {
      return `point(${value[0]},${value[1]})`;
    } else if (config.type === Object) {
      return this.quote(JSONUtil.toUTF8(value).replaceAll("'", "''"));
    }
    throw new AppError(`Unknown value type for field ${config.name}, ${value}`, { category: 'data' });
  }

  /**
   * Get column type from field config
   */
  getColumnType(config: SchemaFieldConfig): string {
    let type: string = '';

    if (config.type === castTo(BigInt)) {
      type = this.COLUMN_TYPES.BIGINT;
    } else if (config.type === Number) {
      type = this.COLUMN_TYPES.INT;
      if (config.precision) {
        const [digits, decimals] = config.precision;
        if (decimals) {
          type = this.PARAMETERIZED_COLUMN_TYPES.DECIMAL(digits, decimals);
        } else if (digits) {
          if (digits < 3) {
            type = this.COLUMN_TYPES.TINYINT;
          } else if (digits < 5) {
            type = this.COLUMN_TYPES.SMALLINT;
          } else if (digits < 7) {
            type = this.COLUMN_TYPES.MEDIUMINT;
          } else if (digits < 10) {
            type = this.COLUMN_TYPES.INT;
          } else {
            type = this.COLUMN_TYPES.BIGINT;
          }
        }
      } else {
        type = this.COLUMN_TYPES.INT;
      }
    } else if (config.type === Date) {
      type = this.COLUMN_TYPES.TIMESTAMP;
    } else if (config.type === Boolean) {
      type = this.COLUMN_TYPES.BOOLEAN;
    } else if (config.type === String) {
      if (config.specifiers?.includes('text')) {
        type = this.COLUMN_TYPES.TEXT;
      } else {
        type = this.PARAMETERIZED_COLUMN_TYPES.VARCHAR(config.maxlength?.limit ?? this.DEFAULT_STRING_LENGTH);
      }
    } else if (config.type === PointConcrete) {
      type = this.COLUMN_TYPES.POINT;
    } else if (config.type === Object) {
      type = this.COLUMN_TYPES.JSON;
    }

    return type;
  }

  /**
   * FieldConfig to Column definition
   */
  getColumnDefinition(config: SchemaFieldConfig, overrideRequired?: boolean): string | undefined {
    const type = this.getColumnType(config);
    if (!type) {
      return;
    }
    const required = overrideRequired ? true : (config.required?.active ?? false);
    return `${this.identifier(config)} ${type} ${required ? 'NOT NULL' : ''}`;
  }

  /**
   * Delete query and return count removed
   */
  async deleteAndGetCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    const { count } = await this.executeSQL<T>(this.getDeleteSQL(SQLModelUtil.classToStack(cls), query.where));
    return DataUtil.coerceType(count, Number);
  }

  /**
   * Get the count for a given query
   */
  async getCountForQuery<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    const { records } = await this.executeSQL<{ total: number }>(
      this.getQueryCountSQL(cls,
        ModelQueryUtil.getWhereClause(cls, query.where)
      )
    );
    return DataUtil.coerceType(records[0].total, Number);
  }

  /**
   * Remove a sql column
   */
  getDropColumnSQL(stack: VisitStack[]): string {
    const field = stack.at(-1)!;
    return `ALTER TABLE ${this.parentTable(stack)} DROP COLUMN ${this.identifier(field.name)};`;
  }

  /**
   * Add a sql column
   */
  getAddColumnSQL(stack: VisitStack[]): string {
    const field: SchemaFieldConfig = castTo(stack.at(-1));
    return `ALTER TABLE ${this.parentTable(stack)} ADD COLUMN ${this.getColumnDefinition(field)};`;
  }

  /**
   * Modify a sql column
   */
  abstract getModifyColumnSQL(stack: VisitStack[]): string;

  /**
   * Determine table/field namespace for a given stack location
   */
  namespace(stack: VisitStack[]): string {
    return `${this.namespacePrefix}${SQLModelUtil.buildTable(stack)}`;
  }

  /**
   * Determine  namespace for a given stack location - 1
   */
  namespaceParent(stack: VisitStack[]): string {
    return this.namespace(stack.slice(0, stack.length - 1));
  }

  /**
   * Determine table name for a given stack location
   */
  table(stack: VisitStack[]): string {
    return this.identifier(this.namespace(stack));
  }

  /**
   * Determine parent table name for a given stack location
   */
  parentTable(stack: VisitStack[]): string {
    return this.table(stack.slice(0, stack.length - 1));
  }

  /**
   * Get lookup key for cls and name
   */
  getKey(cls: Class, name: string): string {
    return `${cls.name}:${name}`;
  }

  /**
   * Alias a field for usage
   */
  alias(field: string | SchemaFieldConfig, alias: string = this.rootAlias): string {
    return `${alias}.${this.identifier(field)}`;
  }

  /**
   * Get alias cache for the stack
   */
  getAliasCache(stack: VisitStack[], resolve: (path: VisitStack[]) => string): Map<string, Alias> {
    const cls = stack[0].type;

    if (this.aliasCache.has(cls)) {
      return this.aliasCache.get(cls)!;
    }

    const clauses = new Map<string, Alias>();
    let idx = 0;

    SQLModelUtil.visitSchemaSync(SchemaRegistryIndex.getConfig(cls), {
      onRoot: ({ descend, path }) => {
        const table = resolve(path);
        clauses.set(table, { alias: this.rootAlias, path });
        return descend();
      },
      onSub: ({ descend, config, path }) => {
        const table = resolve(path);
        clauses.set(table, { alias: `${config.name.charAt(0)}${idx++}`, path });
        return descend();
      },
      onSimple: ({ config, path }) => {
        const table = resolve(path);
        clauses.set(table, { alias: `${config.name.charAt(0)}${idx++}`, path });
      }
    });

    this.aliasCache.set(cls, clauses);

    return clauses;
  }

  /**
   * Resolve field name for given location in stack
   */
  resolveName(stack: VisitStack[]): string {
    const path = this.namespaceParent(stack);
    const name = stack.at(-1)!.name;
    const cache = this.getAliasCache(stack, this.namespace);
    const base = cache.get(path)!;
    return this.alias(name, base.alias);
  }

  /**
   * Generate WHERE field clause
   */
  getWhereFieldSQL(stack: VisitStack[], input: Record<string, unknown>): string {
    const items = [];
    const { foreignMap, localMap } = SQLModelUtil.getFieldsByLocation(stack);
    const SQL_OPS = this.SQL_OPS;

    for (const key of Object.keys(input)) {
      const top = input[key];
      const field = localMap[key] ?? foreignMap[key];
      if (!field) {
        throw new Error(`Unknown field: ${key}`);
      }
      const sStack = [...stack, field];
      if (key in foreignMap && field.array && !SchemaRegistryIndex.has(field.type)) {
        // If dealing with simple external
        sStack.push({
          name: field.name,
          class: null!,
          type: field.type
        });
      }
      const sPath = this.resolveName(sStack);

      if (DataUtil.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.getWhereFieldSQL(sStack, top);
          items.push(inner);
        } else {
          const value = top[subKey];
          const resolve = this.resolveValue.bind(this, field);

          switch (subKey) {
            case '$nin': case '$in': {
              const arr = (Array.isArray(value) ? value : [value]).map(resolve);
              items.push(`${sPath} ${SQL_OPS[subKey]} (${arr.join(',')})`);
              break;
            }
            case '$all': {
              const set = new Set();
              const arr = [value].flat().filter(item => !set.has(item) && !!set.add(item)).map(resolve);
              const valueTable = this.parentTable(sStack);
              const alias = `_all_${sStack.length}`;
              const pPath = this.identifier(this.parentPathField.name);
              const rpPath = this.resolveName([...sStack, field, this.parentPathField]);

              items.push(`${arr.length} = (
                SELECT COUNT(DISTINCT ${alias}.${this.identifier(field.name)}) 
                FROM ${valueTable} ${alias} 
                WHERE ${alias}.${pPath} = ${rpPath}
                AND ${alias}.${this.identifier(field.name)} IN (${arr.join(',')})
              )`);
              break;
            }
            case '$regex': {
              const regex = DataUtil.toRegex(castTo(value));
              const regexSource = regex.source;
              const ins = regex.flags && regex.flags.includes('i');

              if (/^[\^]\S+[.][*][$]?$/.test(regexSource)) {
                const inner = regexSource.substring(1, regexSource.length - 2);
                if (!ins || SQL_OPS.$ilike) {
                  items.push(`${sPath} ${ins ? SQL_OPS.$ilike : SQL_OPS.$like} ${resolve(`${inner}%`)}`);
                } else {
                  items.push(`LOWER(${sPath}) ${SQL_OPS.$like} LOWER(${resolve(`${inner}%`)})`);
                }
              } else {
                if (!ins || SQL_OPS.$iregex) {
                  const result = resolve(value);
                  items.push(`${sPath} ${SQL_OPS[!ins ? subKey : '$iregex']} ${result}`);
                } else {
                  const result = resolve(new RegExp(regexSource.toLowerCase(), regex.flags));
                  items.push(`LOWER(${sPath}) ${SQL_OPS[subKey]} ${result}`);
                }
              }
              break;
            }
            case '$exists': {
              if (field.array) {
                const valueTable = this.parentTable(sStack);
                const alias = `_all_${sStack.length}`;
                const pPath = this.identifier(this.parentPathField.name);
                const rpPath = this.resolveName([...sStack, field, this.parentPathField]);

                items.push(`0 ${!value ? '=' : '<>'} (
                  SELECT COUNT(${alias}.${this.identifier(field.name)})
                  FROM ${valueTable} ${alias} 
                  WHERE ${alias}.${pPath} = ${rpPath}
                )`);
              } else {
                items.push(`${sPath} ${value ? SQL_OPS.$isNot : SQL_OPS.$is} NULL`);
              }
              break;
            }
            case '$ne': case '$eq': {
              if (value === null || value === undefined) {
                items.push(`${sPath} ${subKey === '$ne' ? SQL_OPS.$isNot : SQL_OPS.$is} NULL`);
              } else {
                const base = `${sPath} ${SQL_OPS[subKey]} ${resolve(value)}`;
                items.push(subKey === '$ne' ? `(${base} OR ${sPath} ${SQL_OPS.$is} NULL)` : base);
              }
              break;
            }
            case '$lt': case '$gt': case '$gte': case '$lte': {
              const subItems = TypedObject.keys(castTo<typeof SQL_OPS>(top))
                .map(subSubKey => `${sPath} ${SQL_OPS[subSubKey]} ${resolve(top[subSubKey])}`);
              items.push(subItems.length > 1 ? `(${subItems.join(` ${SQL_OPS.$and} `)})` : subItems[0]);
              break;
            }
            case '$near':
            case '$unit':
            case '$maxDistance':
            case '$geoWithin':
              throw new Error('Geo-spatial queries are not currently supported in SQL');
          }
        }
        // Handle operations
      } else {
        items.push(`${sPath} ${SQL_OPS.$eq} ${this.resolveValue(field, top)}`);
      }
    }
    if (items.length === 1) {
      return items[0];
    } else {
      return `(${items.join(` ${SQL_OPS.$and} `)})`;
    }
  }

  /**
   * Grouping of where clauses
   */
  getWhereGroupingSQL<T>(cls: Class<T>, clause: WhereClause<T>): string {
    const SQL_OPS = this.SQL_OPS;

    if (ModelQueryUtil.has$And(clause)) {
      return `(${clause.$and.map(item => this.getWhereGroupingSQL<T>(cls, item)).join(` ${SQL_OPS.$and} `)})`;
    } else if (ModelQueryUtil.has$Or(clause)) {
      return `(${clause.$or.map(item => this.getWhereGroupingSQL<T>(cls, item)).join(` ${SQL_OPS.$or} `)})`;
    } else if (ModelQueryUtil.has$Not(clause)) {
      return `${SQL_OPS.$not} (${this.getWhereGroupingSQL<T>(cls, clause.$not)})`;
    } else {
      return this.getWhereFieldSQL(SQLModelUtil.classToStack(cls), clause);
    }
  }

  /**
   * Generate WHERE clause
   */
  getWhereSQL<T>(cls: Class<T>, where?: WhereClause<T>): string {
    return !where || !Object.keys(where).length ?
      '' :
      `WHERE ${this.getWhereGroupingSQL(cls, castTo(where))}`;
  }

  /**
   * Generate ORDER BY clause
   */
  getOrderBySQL<T>(cls: Class<T>, sortBy?: SortClause<T>[]): string {
    return !sortBy ?
      '' :
      `ORDER BY ${SQLModelUtil.orderBy(cls, sortBy).map((item) =>
        `${this.resolveName(item.stack)} ${item.asc ? 'ASC' : 'DESC'}`
      ).join(', ')}`;
  }

  /**
   * Generate SELECT clause
   */
  getSelectSQL<T>(cls: Class<T>, select?: SelectClause<T>): string {
    const stack = SQLModelUtil.classToStack(cls);
    const columns = select && SQLModelUtil.select(cls, select).map((sel) => this.resolveName([...stack, sel]));
    if (columns) {
      columns.unshift(this.alias(this.pathField));
    }
    return !columns ?
      `SELECT ${this.rootAlias}.* ` :
      `SELECT ${columns.join(', ')}`;
  }

  /**
   * Generate FROM clause
   */
  getFromSQL<T>(cls: Class<T>): string {
    const stack = SQLModelUtil.classToStack(cls);
    const aliases = this.getAliasCache(stack, this.namespace);
    const tables = [...aliases.keys()].toSorted((a, b) => a.length - b.length); // Shortest first
    return `FROM ${tables.map((table) => {
      const { alias, path } = aliases.get(table)!;
      let from = `${this.identifier(table)} ${alias}`;
      if (path.length > 1) {
        const key = this.namespaceParent(path);
        const { alias: parentAlias } = aliases.get(key)!;
        from = `
LEFT OUTER JOIN ${from} ON
  ${this.alias(this.parentPathField, alias)} = ${this.alias(this.pathField, parentAlias)}
`;
      }
      return from;
    }).join('\n')}`;
  }

  /**
   * Generate LIMIT clause
   */
  getLimitSQL<T>(cls: Class<T>, query?: Query<T>): string {
    return !query || (!query.limit && !query.offset) ?
      '' :
      `LIMIT ${query.limit ?? 200} OFFSET ${query.offset ?? 0}`;
  }

  /**
   * Generate GROUP BY clause
   */
  getGroupBySQL<T>(cls: Class<T>, query: Query<T>): string {
    const sortFields = !query.sort ?
      '' :
      SQLModelUtil.orderBy(cls, query.sort)
        .map(item => this.resolveName(item.stack))
        .join(', ');

    return `GROUP BY ${this.alias(this.idField)}${sortFields ? `, ${sortFields}` : ''}`;
  }

  /**
   * Generate full query
   */
  getQuerySQL<T>(cls: Class<T>, query: Query<T>, where?: WhereClause<T>): string {
    return `
${this.getSelectSQL(cls, query.select)}
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, where)}
${this.getGroupBySQL(cls, query)}
${this.getOrderBySQL(cls, query.sort)}
${this.getLimitSQL(cls, query)}`;
  }

  getCreateTableSQL(stack: VisitStack[]): string {
    const config = stack.at(-1)!;
    const parent = stack.length > 1;
    const array = parent && config.array;
    const fields = SchemaRegistryIndex.has(config.type) ?
      [...SQLModelUtil.getFieldsByLocation(stack).local] :
      (array ? [castTo<SchemaFieldConfig>(config)] : []);

    if (!parent) {
      let idField = fields.find(field => field.name === this.idField.name);
      if (!idField) {
        fields.push(idField = this.idField);
      }
    }

    const fieldSql = fields
      .map(field => this.getColumnDefinition(field, field.name === this.idField.name && !parent) || '')
      .filter(line => !!line.trim())
      .join(',\n  ');

    const out = `
CREATE TABLE IF NOT EXISTS ${this.table(stack)} (
  ${fieldSql}${fieldSql.length ? ',' : ''}
  ${this.getColumnDefinition(this.pathField)} UNIQUE,
  ${!parent ?
        `PRIMARY KEY (${this.identifier(this.idField)})` :
        `${this.getColumnDefinition(this.parentPathField)},
    ${array ? `${this.getColumnDefinition(this.idxField)},` : ''}
  PRIMARY KEY (${this.identifier(this.pathField)}),
  FOREIGN KEY (${this.identifier(this.parentPathField)}) REFERENCES ${this.parentTable(stack)}(${this.identifier(this.pathField)}) ON DELETE CASCADE`}
);`;
    return out;
  }

  /**
   * Generate drop SQL
   */
  getDropTableSQL(stack: VisitStack[]): string {
    return `DROP TABLE IF EXISTS ${this.table(stack)}; `;
  }

  /**
   * Generate truncate SQL
   */
  getTruncateTableSQL(stack: VisitStack[]): string {
    return `TRUNCATE ${this.table(stack)}; `;
  }

  /**
   * Get all table create queries for a class
   */
  getCreateAllTablesSQL(cls: Class): string[] {
    const out: string[] = [];
    SQLModelUtil.visitSchemaSync(SchemaRegistryIndex.getConfig(cls), {
      onRoot: ({ path, descend }) => { out.push(this.getCreateTableSQL(path)); descend(); },
      onSub: ({ path, descend }) => { out.push(this.getCreateTableSQL(path)); descend(); },
      onSimple: ({ path }) => out.push(this.getCreateTableSQL(path))
    });
    return out;
  }

  /**
   * Get all create indices need for a given class
   */
  getCreateAllIndicesSQL<T extends ModelType>(cls: Class<T>, indices: IndexConfig<T>[]): string[] {
    return indices.map(idx => this.getCreateIndexSQL(cls, idx));
  }

  /**
   * Get index name
   */
  getIndexName<T extends ModelType>(cls: Class<T>, idx: IndexConfig<ModelType>): string {
    const table = this.namespace(SQLModelUtil.classToStack(cls));
    return ['idx', table, idx.name.toLowerCase().replaceAll('-', '_')].join('_');
  }

  /**
   * Get CREATE INDEX sql
   */
  getCreateIndexSQL<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T>): string {
    const table = this.namespace(SQLModelUtil.classToStack(cls));
    const fields: [string, boolean][] = idx.fields.map(field => {
      const key = TypedObject.keys(field)[0];
      const value = field[key];
      if (DataUtil.isPlainObject(value)) {
        throw new Error('Unable to supported nested fields for indices');
      }
      return [castTo(key), typeof value === 'number' ? value === 1 : (!!value)];
    });
    const constraint = this.getIndexName(cls, idx);
    return `CREATE ${idx.type === 'unique' ? 'UNIQUE ' : ''}INDEX ${constraint} ON ${this.identifier(table)} (${fields
      .map(([name, sel]) => `${this.identifier(name)} ${sel ? 'ASC' : 'DESC'}`)
      .join(', ')});`;
  }

  /**
   * Get DROP INDEX sql
   */
  getDropIndexSQL<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string): string {
    const constraint = typeof idx === 'string' ? idx : this.getIndexName(cls, idx);
    return `DROP INDEX ${this.identifier(constraint)} ;`;
  }

  /**
   * Drop all tables for a given class
   */
  getDropAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    const out: string[] = [];
    SQLModelUtil.visitSchemaSync(SchemaRegistryIndex.getConfig(cls), {
      onRoot: ({ path, descend }) => { descend(); out.push(this.getDropTableSQL(path)); },
      onSub: ({ path, descend }) => { descend(); out.push(this.getDropTableSQL(path)); },
      onSimple: ({ path }) => out.push(this.getDropTableSQL(path))
    });
    return out;
  }

  /**
   * Truncate all tables for a given class
   */
  getTruncateAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    const out: string[] = [];
    SQLModelUtil.visitSchemaSync(SchemaRegistryIndex.getConfig(cls), {
      onRoot: ({ path, descend }) => { descend(); out.push(this.getTruncateTableSQL(path)); },
      onSub: ({ path, descend }) => { descend(); out.push(this.getTruncateTableSQL(path)); },
      onSimple: ({ path }) => out.push(this.getTruncateTableSQL(path))
    });
    return out;
  }

  /**
   * Get INSERT sql for a given instance and a specific stack location
   */
  getInsertSQL(stack: VisitStack[], instances: InsertWrapper['records']): string | undefined {
    const config = stack.at(-1)!;
    const columns = SQLModelUtil.getFieldsByLocation(stack).local
      .filter(field => !SchemaRegistryIndex.has(field.type))
      .toSorted((a, b) => a.name.localeCompare(b.name));
    const columnNames = columns.map(column => column.name);

    const hasParent = stack.length > 1;
    const isArray = !!config.array;

    if (isArray) {
      const newInstances: typeof instances = [];
      for (const instance of instances) {
        if (instance.value === null || instance.value === undefined) {
          continue;
        } else if (Array.isArray(instance.value)) {
          const name = instance.stack.at(-1)!.name;
          for (const sel of instance.value) {
            newInstances.push({
              stack: instance.stack,
              value: {
                [name]: sel
              }
            });
          }
        } else {
          newInstances.push(instance);
        }
      }
      instances = newInstances;
    }

    if (!instances.length) {
      return;
    }

    const matrix = instances.map(inst => columns.map(column =>
      this.resolveValue(column, castTo<Record<string, unknown>>(inst.value)[column.name])));

    columnNames.push(this.pathField.name);
    if (hasParent) {
      columnNames.push(this.parentPathField.name);
      if (isArray) {
        columnNames.push(this.idxField.name);
      }
    }

    const idx = config.index ?? 0;

    for (let i = 0; i < matrix.length; i++) {
      const { stack: elStack } = instances[i];
      if (hasParent) {
        matrix[i].push(this.hash(`${SQLModelUtil.buildPath(elStack)}${isArray ? `[${i + idx}]` : ''}`));
        matrix[i].push(this.hash(SQLModelUtil.buildPath(elStack.slice(0, elStack.length - 1))));
        if (isArray) {
          matrix[i].push(this.resolveValue(this.idxField, i + idx));
        }
      } else {
        matrix[i].push(this.hash(SQLModelUtil.buildPath(elStack)));
      }
    }

    return `
INSERT INTO ${this.table(stack)} (${columnNames.map(this.identifier).join(', ')})
VALUES
${matrix.map(row => `(${row.join(', ')})`).join(',\n')};`;
  }

  /**
   * Get ALL Insert queries as needed
   */
  getAllInsertSQL<T extends ModelType>(cls: Class<T>, instance: T): string[] {
    const out: string[] = [];
    const add = (text?: string): void => { text && out.push(text); };
    SQLModelUtil.visitSchemaInstance(cls, instance, {
      onRoot: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }])),
      onSub: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }])),
      onSimple: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }]))
    });
    return out;
  }

  /**
   * Simple data base updates
   */
  getUpdateSQL(stack: VisitStack[], data: Record<string, unknown>, where?: WhereClause<unknown>): string {
    const { type } = stack.at(-1)!;
    const { localMap } = SQLModelUtil.getFieldsByLocation(stack);
    return `
UPDATE ${this.table(stack)} ${this.rootAlias}
SET
  ${Object
        .entries(data)
        .filter(([key]) => key in localMap)
        .map(([key, value]) => `${this.identifier(key)}=${this.resolveValue(localMap[key], value)}`).join(', ')}
  ${this.getWhereSQL(type, where)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<unknown>): string {
    const { type } = stack.at(-1)!;
    return `
DELETE
FROM ${this.table(stack)} ${this.rootAlias}
${this.getWhereSQL(type, where)};`;
  }

  /**
   * Get elements by ids
   */
  getSelectRowsByIdsSQL(stack: VisitStack[], ids: string[], select: SchemaFieldConfig[] = []): string {
    const config = stack.at(-1)!;
    const orderBy = !config.array ?
      '' :
      `ORDER BY ${this.rootAlias}.${this.idxField.name} ASC`;

    const idField = (stack.length > 1 ? this.parentPathField : this.idField);

    return `
SELECT ${select.length ? select.map(field => this.alias(field)).join(',') : '*'}
FROM ${this.table(stack)} ${this.rootAlias}
WHERE ${this.alias(idField)} IN (${ids.map(id => this.resolveValue(idField, id)).join(', ')})
${orderBy};`;
  }

  /**
   * Get COUNT(1) query
   */
  getQueryCountSQL<T>(cls: Class<T>, where?: WhereClause<T>): string {
    return `
SELECT COUNT(DISTINCT ${this.rootAlias}.id) as total
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, where!)}`;
  }

  async fetchDependents<T>(cls: Class<T>, items: T[], select?: SelectClause<T>): Promise<T[]> {
    const stack: Record<string, unknown>[] = [];
    const selectStack: (SelectClause<T> | undefined)[] = [];

    const buildSet = (children: unknown[], field?: SchemaFieldConfig): Record<string, unknown> =>
      SQLModelUtil.collectDependents(this, stack.at(-1)!, children, field);

    await SQLModelUtil.visitSchema(SchemaRegistryIndex.getConfig(cls), {
      onRoot: async (config) => {
        const fieldSet = buildSet(items); // Already filtered by initial select query
        selectStack.push(select);
        stack.push(fieldSet);
        await config.descend();
      },
      onSub: async ({ config, descend, fields, path }) => {
        const top = stack.at(-1)!;
        const ids = Object.keys(top);
        const selectTop = selectStack.at(-1)!;
        const fieldKey = castKey<RetainQueryPrimitiveFields<T>>(config.name);
        const subSelectTop: SelectClause<T> | undefined = castTo(selectTop?.[fieldKey]);

        // See if a selection exists at all
        const selected: SchemaFieldConfig[] = subSelectTop ? fields
          .filter(field => typeof subSelectTop === 'object' && subSelectTop[castTo<typeof fieldKey>(field.name)] === 1)
          : [];

        if (selected.length) {
          selected.push(this.pathField, this.parentPathField);
          if (config.array) {
            selected.push(this.idxField);
          }
        }

        // If children and selection exists
        if (ids.length && (!subSelectTop || selected)) {
          const { records: children } = await this.executeSQL<unknown[]>(this.getSelectRowsByIdsSQL(
            path,
            ids,
            selected
          ));

          const fieldSet = buildSet(children, config);
          try {
            stack.push(fieldSet);
            selectStack.push(subSelectTop);
            await descend();
          } finally {
            selectStack.pop();
            stack.pop();
          }
        }
      },
      onSimple: async ({ config, path }): Promise<void> => {
        const top = stack.at(-1)!;
        const ids = Object.keys(top);
        if (ids.length) {
          const { records: matching } = await this.executeSQL(this.getSelectRowsByIdsSQL(
            path,
            ids
          ));
          buildSet(matching, config);
        }
      }
    });

    return items;
  }

  /**
   * Delete all ids
   */
  async deleteByIds(stack: VisitStack[], ids: string[]): Promise<number> {
    return this.deleteAndGetCount<ModelType>(stack.at(-1)!.type, {
      where: {
        [stack.length === 1 ? this.idField.name : this.pathField.name]: {
          $in: ids
        }
      }
    });
  }

  /**
   * Do bulk process
   */
  async bulkProcess(deletes: DeleteWrapper[], inserts: InsertWrapper[], upserts: InsertWrapper[], updates: InsertWrapper[]): Promise<BulkResponse> {
    const out = {
      counts: {
        delete: deletes.reduce((count, item) => count + item.ids.length, 0),
        error: 0,
        insert: inserts.filter(item => item.stack.length === 1).reduce((count, item) => count + item.records.length, 0),
        update: updates.filter(item => item.stack.length === 1).reduce((count, item) => count + item.records.length, 0),
        upsert: upserts.filter(item => item.stack.length === 1).reduce((count, item) => count + item.records.length, 0)
      },
      errors: [],
      insertedIds: new Map()
    };

    // Full removals
    await Promise.all(deletes.map(item => this.deleteByIds(item.stack, item.ids)));

    // Adding deletes
    if (upserts.length || updates.length) {
      const idx = this.idField.name;

      await Promise.all([
        ...upserts
          .filter(item => item.stack.length === 1)
          .map(item =>
            this.deleteByIds(item.stack, item.records.map(value => castTo<Record<string, string>>(value.value)[idx]))
          ),
        ...updates
          .filter(item => item.stack.length === 1)
          .map(item =>
            this.deleteByIds(item.stack, item.records.map(value => castTo<Record<string, string>>(value.value)[idx]))
          ),
      ]);
    }

    // Adding
    for (const items of [inserts, upserts, updates]) {
      if (!items.length) {
        continue;
      }
      let level = 1; // Add by level
      for (; ;) { // Loop until done
        const leveled = items.filter(insertWrapper => insertWrapper.stack.length === level);
        if (!leveled.length) {
          break;
        }
        await Promise.all(leveled
          .map(inserted => this.getInsertSQL(inserted.stack, inserted.records))
          .filter(sql => !!sql)
          .map(sql => this.executeSQL(sql!)));
        level += 1;
      }
    }

    return out;
  }

  /**
   * Determine if a column has changed
   */
  isColumnChanged(requested: SchemaFieldConfig, existing: SQLTableDescription['columns'][number],): boolean {
    const requestedColumnType = this.getColumnType(requested);
    const result =
      (requested.name !== this.idField.name && !!requested.required?.active !== !!existing.is_not_null)
      || (requestedColumnType.toUpperCase() !== existing.type.toUpperCase());

    return result;
  }

  /**
   * Determine if an index has changed
   */
  isIndexChanged(requested: IndexConfig<ModelType>, existing: SQLTableDescription['indices'][number]): boolean {
    let result =
      (existing.is_unique && requested.type !== 'unique')
      || requested.fields.length !== existing.columns.length;

    for (let i = 0; i < requested.fields.length && !result; i++) {
      const [[key, value]] = Object.entries(requested.fields[i]);
      const desc = value === -1;
      result ||= key !== existing.columns[i].name && desc !== existing.columns[i].desc;
    }

    return result;
  }

  /**
   * Enforce the dialect specific id length
   */
  enforceIdLength(cls: Class<ModelType>): void {
    const config = SchemaRegistryIndex.getConfig(cls);
    const idField = config.fields[this.idField.name];
    if (idField) {
      idField.maxlength = { limit: this.ID_LENGTH };
      idField.minlength = { limit: this.ID_LENGTH };
    }
  }
}