import { Class } from '@travetto/registry';
import { SchemaRegistry, FieldConfig, Schema } from '@travetto/schema';
import { Util, AppError } from '@travetto/base';
import { SelectClause, Query, SortClause, WhereClause } from '@travetto/model-query';
import { BulkResponse, IndexConfig } from '@travetto/model';

import { SQLUtil, VisitStack } from '../internal/util';
import { DeleteWrapper, InsertWrapper, DialectState } from '../internal/types';
import { Connection } from '../connection/base';

const has$And = (o: any): o is ({ $and: WhereClause<any>[] }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[] }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any> }) => '$not' in o;

interface Alias {
  alias: string;
  path: VisitStack[];
}

@Schema()
class Total {
  total: number;
}

function makeField(name: string, type: Class, required: boolean, extra: any) {
  return {
    name,
    owner: null,
    type,
    array: false,
    ...(required ? { required: { active: true } } : {}),
    ...extra
  } as FieldConfig;
}

/**
 * Base sql dialect
 */
export abstract class SQLDialect implements DialectState {
  /**
   * Default length of unique ids
   */
  KEY_LEN = 64;
  /**
   * Default length for varchar
   */
  DEFAULT_STRING_LEN = 1024;

  /**
   * Mapping between query ops and SQL operations
   */
  SQL_OPS = {
    $and: 'AND',
    $or: 'OR',
    $not: 'NOT',
    $all: '=ALL',
    $regex: '<unknown>',
    $iregex: '<unknown>',
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
    BOOLEAN: 'BOOLEAN',
    TINYINT: 'TINYINT',
    SMALLINT: 'SMALLINT',
    MEDIUMINIT: 'MEDIUMINT',
    INT: 'INT',
    BIGINT: 'BIGINT',
    TIMESTAMP: 'TIMESTAMP',
    TEXT: 'TEXT'
  };

  /**
   * Column types with inputs
   */
  PARAMETERIZED_COLUMN_TYPES: Record<'VARCHAR' | 'DECIMAL', (...nums: number[]) => string> = {
    VARCHAR: n => `VARCHAR(${n})`,
    DECIMAL: (d, p) => `DECIMAL(${d},${p})`
  };

  /**
   * Generate an id field
   */
  idField = makeField('id', String, true, {
    maxlength: { n: 32 },
    minlength: { n: 32 }
  });

  /**
   * Generate an idx field
   */
  idxField = makeField('__idx', Number, true, {});

  /**
   * Parent path reference
   */
  parentPathField = makeField('__parent_path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  /**
   * Path reference
   */
  pathField = makeField('__path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  regexWordBoundary = '\\b';

  rootAlias = '_ROOT';

  aliasCache = new Map<Class, Map<string, Alias>>();

  constructor(public ns: string) {
    this.namespace = this.namespace.bind(this);
    this.table = this.table.bind(this);
    this.ident = this.ident.bind(this);

    if (this.ns) {
      this.ns = `${this.ns}_`;
    }
  }

  /**
   * Get connection
   */
  abstract get conn(): Connection<any>;

  /**
   * Hash a value
   */
  abstract hash(inp: string): string;

  executeSQL<T>(sql: string) {
    return this.conn.execute<T>(this.conn.active, sql);
  }

  /**
   * Identify a name or field (escape it)
   */
  abstract ident(name: string | FieldConfig): string;

  quote(text: string): string {
    return `'${text.replace(/[']/g, `''`)}'`;
  }

  /**
   * Convert value to SQL valid representation
   */
  resolveValue(conf: FieldConfig, value: any) {
    if (value === undefined || value === null) {
      return 'NULL';
    } else if (conf.type === String) {
      if (value instanceof RegExp) {
        const src = Util.toRegex(value).source.replace(/\\b/g, this.regexWordBoundary);
        return this.quote(src);
      } else {
        return this.quote(value);
      }
    } else if (conf.type === Boolean) {
      return `${value ? 'TRUE' : 'FALSE'}`;
    } else if (conf.type === Number) {
      return `${value}`;
    } else if (conf.type === Date) {
      const [day, time] = (value as Date).toISOString().split(/[T.]/);
      return this.quote(`${day} ${time}`);
    } else if (conf.type === Object) {
      return this.quote(JSON.stringify(value).replace(/[']/g, `''`));
    }
    throw new AppError(`Unknown value type for field ${conf.name}, ${value}`, 'data');
  }

  /**
   * Get column type from field config
   */
  getColumnType(conf: FieldConfig) {
    let type: string = '';

    if (conf.type === Number) {
      type = this.COLUMN_TYPES.INT;
      if (conf.precision) {
        const [digits, decimals] = conf.precision;
        if (decimals) {
          type = this.PARAMETERIZED_COLUMN_TYPES.DECIMAL(digits, decimals);
        } else if (digits) {
          if (digits < 3) {
            type = this.COLUMN_TYPES.TINYINT;
          } else if (digits < 5) {
            type = this.COLUMN_TYPES.SMALLINT;
          } else if (digits < 7) {
            type = this.COLUMN_TYPES.MEDIUMINIT;
          } else if (digits < 10) {
            type = this.COLUMN_TYPES.INT;
          } else {
            type = this.COLUMN_TYPES.BIGINT;
          }
        }
      } else {
        type = this.COLUMN_TYPES.INT;
      }
    } else if (conf.type === Date) {
      type = this.COLUMN_TYPES.TIMESTAMP;
    } else if (conf.type === Boolean) {
      type = this.COLUMN_TYPES.BOOLEAN;
    } else if (conf.type === String) {
      if (conf.specifier && conf.specifier.startsWith('text')) {
        type = this.COLUMN_TYPES.TEXT;
      } else {
        type = this.PARAMETERIZED_COLUMN_TYPES.VARCHAR(conf.maxlength ? conf.maxlength.n : this.DEFAULT_STRING_LEN);
      }
    } else if (conf.type === Object) {
      type = this.COLUMN_TYPES.JSON;
    }

    return type;
  }

  /**
   * FieldConfig to Column definition
   */
  getColumnDefinition(conf: FieldConfig) {
    const type = this.getColumnType(conf);
    if (!type) {
      return;
    }
    return `${this.ident(conf)} ${type} ${(conf.required && conf.required.active) ? 'NOT NULL' : 'DEFAULT NULL'}`;
  }

  /**
   * Delete query and return count removed
   */
  async deleteAndGetCount<T>(cls: Class<T>, query: Query<T>) {
    const { count } = await this.executeSQL(this.getDeleteSQL(SQLUtil.classToStack(cls), query.where));
    return count;
  }

  /**
   * Get the count for a given query
   */
  async getCountForQuery<T>(cls: Class<T>, query: Query<T>) {
    const { records } = await this.executeSQL<{ total: number }>(this.getQueryCountSQL(cls, query));
    const [record] = records;
    return Total.from(record).total;
  }

  /**
   * Remove a sql column
   */
  getDropColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.parentTable(stack)} DROP COLUMN ${this.ident(field.name)};`;
  }

  /**
   * Add a sql column
   */
  getAddColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.parentTable(stack)} ADD COLUMN ${this.getColumnDefinition(field as FieldConfig)};`;
  }

  /**
   * Modify a sql column
   */
  abstract getModifyColumnSQL(stack: VisitStack[]): string;

  /**
   * Generate a UUID
   */
  generateId(): string {
    return Util.uuid(this.KEY_LEN);
  }

  /**
   * Determine table/field namespace for a given stack location
   */
  namespace(stack: VisitStack[]) {
    return `${this.ns}${SQLUtil.buildTable(stack)}`;
  }

  /**
   * Determine  namespace for a given stack location - 1
   */
  namespaceParent(stack: VisitStack[]) {
    return this.namespace(stack.slice(0, stack.length - 1));
  }

  /**
   * Determine table name for a given stack location
   */
  table(stack: VisitStack[]) {
    return this.ident(this.namespace(stack));
  }

  /**
   * Determine parent table name for a given stack location
   */
  parentTable(stack: VisitStack[]) {
    return this.table(stack.slice(0, stack.length - 1));
  }

  /**
   * Get lookup key for cls and name
   */
  getKey(cls: Class, name: string) {
    return `${cls.name}:${name}`;
  }

  /**
   * Alias a field for usage
   */
  alias(field: string | FieldConfig, alias: string = this.rootAlias) {
    return `${alias}.${this.ident(field)}`;
  }

  /**
   * Get alias cache for the stack
   */
  getAliasCache(stack: VisitStack[], resolve: (path: VisitStack[]) => string) {
    const cls = stack[0].type;

    if (this.aliasCache.has(cls)) {
      return this.aliasCache.get(cls)!;
    }

    const clauses = new Map<string, Alias>();
    let idx = 0;

    SQLUtil.visitSchemaSync(SchemaRegistry.get(cls), {
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
    const name = stack[stack.length - 1].name;
    const cache = this.getAliasCache(stack, this.namespace);
    const base = cache.get(path)!;
    return this.alias(name, base.alias);
  }

  /**
   * Generate WHERE field clause
   */
  getWhereFieldSQL(stack: VisitStack[], o: Record<string, any>): any {
    const items = [];
    const { foreignMap, localMap } = SQLUtil.getFieldsByLocation(stack);
    const SQL_OPS = this.SQL_OPS;

    for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
      const top = o[key];
      const field = localMap[key] ?? foreignMap[key];
      if (!field) {
        throw new Error(`Unknown field: ${key}`);
      }
      const sStack = [...stack, field];
      if (key in foreignMap && field.array && !SchemaRegistry.has(field.type)) {
        // If dealing with simple external
        sStack.push({
          name: field.name,
          type: field.type
        });
      }
      const sPath = this.resolveName(sStack);

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.getWhereFieldSQL(sStack, top);
          items.push(inner);
        } else {
          const v = top[subKey];
          const resolve = this.resolveValue.bind(this, field);

          switch (subKey) {
            case '$nin': case '$in': {
              const arr = (Array.isArray(v) ? v : [v]).map(el => resolve(el));
              items.push(`${sPath} ${SQL_OPS[subKey]} (${arr.join(',')})`);
              break;
            }
            case '$all': {
              const arr = [...new Set(Array.isArray(v) ? v : [v])].map(el => resolve(el));
              const valueTable = this.parentTable(sStack);
              const alias = `_all_${sStack.length}`;
              const ppath = this.ident(this.parentPathField.name);
              const rppath = this.resolveName([...sStack, field, this.parentPathField]);

              items.push(`${arr.length} = (
                SELECT COUNT(DISTINCT ${alias}.${this.ident(field.name)}) 
                FROM ${valueTable} ${alias} 
                WHERE ${alias}.${ppath} = ${rppath}
                AND ${alias}.${this.ident(field.name)} IN (${arr.join(',')})
              )`);
              break;
            }
            case '$regex': {
              const re = Util.toRegex(v);
              const src = re.source;
              const ins = re.flags && re.flags.includes('i');

              if (/^[\^]\S+[.][*][$]?$/.test(src)) {
                const inner = src.substring(1, src.length - 2);
                items.push(`${sPath} ${ins ? SQL_OPS.$ilike : SQL_OPS.$like} ${resolve(`${inner}%`)}`);
              } else {
                const val = resolve(v);
                items.push(`${sPath} ${SQL_OPS[!ins ? subKey : '$iregex']} ${val}`);
              }
              break;
            }
            case '$exists': items.push(`${sPath} ${v ? SQL_OPS.$isNot : SQL_OPS.$is} NULL`); break;
            case '$ne': case '$eq': {
              if (v === null || v === undefined) {
                items.push(`${sPath} ${subKey === '$ne' ? SQL_OPS.$isNot : SQL_OPS.$is} NULL`);
              } else {
                const base = `${sPath} ${SQL_OPS[subKey]} ${resolve(v)}`;
                items.push(subKey === '$ne' ? `(${base} OR ${sPath} ${SQL_OPS.$is} NULL)` : base);
              }
              break;
            }
            case '$lt': case '$gt': case '$gte': case '$lte': {
              const subItems = (Object.keys(top) as (keyof typeof SQL_OPS)[])
                .map(ssk => `${sPath} ${SQL_OPS[ssk]} ${resolve(top[ssk])}`);
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
  getWhereGroupingSQL<T>(cls: Class<T>, o: WhereClause<T>): string {
    const SQL_OPS = this.SQL_OPS;

    if (has$And(o)) {
      return `(${o.$and.map(x => this.getWhereGroupingSQL<T>(cls, x)).join(` ${SQL_OPS.$and} `)})`;
    } else if (has$Or(o)) {
      return `(${o.$or.map(x => this.getWhereGroupingSQL<T>(cls, x)).join(` ${SQL_OPS.$or} `)})`;
    } else if (has$Not(o)) {
      return `${SQL_OPS.$not} (${this.getWhereGroupingSQL<T>(cls, o.$not)})`;
    } else {
      return this.getWhereFieldSQL(SQLUtil.classToStack(cls), o);
    }
  }

  /**
   * Generate WHERE clause
   */
  getWhereSQL<T>(cls: Class<T>, where?: WhereClause<T>): string {
    return !where || !Object.keys(where).length ?
      '' :
      `WHERE ${this.getWhereGroupingSQL(cls, where)}`;
  }

  /**
   * Generate ORDER BY clause
   */
  getOrderBySQL<T>(cls: Class<T>, sortBy?: SortClause<T>[]): string {
    return !sortBy ?
      '' :
      `ORDER BY ${SQLUtil.orderBy(cls, sortBy).map((ob) =>
        `${this.resolveName(ob.stack)} ${ob.asc ? 'ASC' : 'DESC'}`
      ).join(', ')}`;
  }

  /**
   * Generate SELECT clause
   */
  getSelectSQL<T>(cls: Class<T>, select?: SelectClause<T>): string {
    const stack = SQLUtil.classToStack(cls);
    const columns = select && SQLUtil.select(cls, select).map((sel) => this.resolveName([...stack, sel]));
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
    const stack = SQLUtil.classToStack(cls);
    const aliases = this.getAliasCache(stack, this.namespace);
    const tables = [...aliases.keys()].sort((a, b) => a.length - b.length); // Shortest first
    return `FROM ${tables.map((table, i) => {
      const { alias, path } = aliases.get(table)!;
      let from = `${this.ident(table)} ${alias}`;
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
  getGroupBySQL<T>(cls: Class<T>, query?: Query<T>): string {
    return `GROUP BY ${this.alias(this.idField)}`;
  }

  /**
   * Generate full query
   */
  getQuerySQL<T>(cls: Class<T>, query: Query<T>) {
    const sortFields = !query.sort ?
      '' :
      SQLUtil.orderBy(cls, query.sort)
        .map(x => this.resolveName(x.stack))
        .join(', ');
    return `
${this.getSelectSQL(cls, query.select)}
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, query.where)}
${this.getGroupBySQL(cls, query)}${sortFields ? `, ${sortFields}` : ''}
${this.getOrderBySQL(cls, query.sort)}
${this.getLimitSQL(cls, query)}`;
  }

  getCreateTableSQL(stack: VisitStack[]) {
    const config = stack[stack.length - 1];
    const parent = stack.length > 1;
    const array = parent && config.array;

    if (config.type && config.type.ᚕsynthetic) {
      throw new AppError(`Cannot create SQL tables for synthetic types, please convert ${SQLUtil.buildPath(stack)} to a concrete class`);
    }

    const fields = SchemaRegistry.has(config.type) ?
      [...SQLUtil.getFieldsByLocation(stack).local] :
      (array ? [config as FieldConfig] : []);

    if (!parent) {
      let idField = fields.find(x => x.name === this.idField.name);
      if (!idField) {
        fields.push(idField = this.idField);
      } else {
        idField.maxlength = { n: this.KEY_LEN };
      }
    }

    /* eslint-disable @typescript-eslint/indent */
    const out = `
CREATE TABLE IF NOT EXISTS ${this.table(stack)} (
  ${fields
        .map(f => {
          const def = this.getColumnDefinition(f) || '';
          return f.name === this.idField.name && !parent ?
            def.replace('DEFAULT NULL', 'NOT NULL') : def;
        })
        .filter(x => !!x.trim())
        .join(',\n  ')},
  ${this.getColumnDefinition(this.pathField)} UNIQUE,
  ${!parent ?
        `PRIMARY KEY (${this.ident(this.idField)})` :
        `${this.getColumnDefinition(this.parentPathField)},
    ${array ? `${this.getColumnDefinition(this.idxField)},` : ''}
  PRIMARY KEY (${this.ident(this.pathField)}),
  FOREIGN KEY (${this.ident(this.parentPathField)}) REFERENCES ${this.parentTable(stack)}(${this.ident(this.pathField)}) ON DELETE CASCADE`}
);`;
    return out;
  }

  /**
   * Generate drop SQL
   */
  getDropTableSQL(stack: VisitStack[]) {
    return `DROP TABLE IF EXISTS ${this.table(stack)}; `;
  }

  /**
   * Get all table creat queries for a class
   */
  getCreateAllTablesSQL(cls: Class<any>): string[] {
    const out: string[] = [];
    SQLUtil.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: ({ path, descend }) => { out.push(this.getCreateTableSQL(path)); descend(); },
      onSub: ({ path, descend }) => { out.push(this.getCreateTableSQL(path)); descend(); },
      onSimple: ({ path }) => out.push(this.getCreateTableSQL(path))
    });
    return out;
  }

  /**
   * Get all create indices need for a given class
   */
  getCreateAllIndicesSQL<T>(cls: Class<T>, indices: IndexConfig<T>[]): string[] {
    return indices.map(idx => this.getCreateIndexSQL(cls, idx));
  }

  /**
   * Get CREATE INDEX sql
   */
  getCreateIndexSQL<T>(cls: Class<T>, idx: IndexConfig<T>): string {
    const table = this.namespace(SQLUtil.classToStack(cls));
    const fields: [string, boolean][] = idx.fields.map(x => {
      const key = Object.keys(x)[0] as keyof typeof x;
      const val = x[key];
      if (Util.isPlainObject(val)) {
        throw new Error('Unable to supported nested fields for indices');
      }
      return [key as string, typeof val === 'number' ? val === 1 : (!!val)];
    });
    const constraint = `idx_${table}_${fields.map(([f]) => f).join('_')}`;
    return `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX ${constraint} ON ${this.ident(table)} (${fields
      .map(([name, sel]) => `${this.ident(name)} ${sel ? 'ASC' : 'DESC'}`)
      .join(', ')});`;
  }

  /**
   * Drop all tables for a given class
   */
  getDropAllTablesSQL(cls: Class<any>): string[] {
    const out: string[] = [];
    SQLUtil.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: ({ path, descend }) => { descend(); out.push(this.getDropTableSQL(path)); },
      onSub: ({ path, descend }) => { descend(); out.push(this.getDropTableSQL(path)); },
      onSimple: ({ path }) => out.push(this.getDropTableSQL(path))
    });
    return out;
  }

  /**
   * Get INSERT sql for a given instance and a specific stack location
   */
  getInsertSQL(stack: VisitStack[], instances: InsertWrapper['records']): string | undefined {
    const config = stack[stack.length - 1];
    const columns = SQLUtil.getFieldsByLocation(stack).local
      .filter(x => !SchemaRegistry.has(x.type))
      .sort((a, b) => a.name.localeCompare(b.name));
    const columnNames = columns.map(c => c.name);

    const hasParent = stack.length > 1;
    const isArray = !!config.array;

    if (isArray) {
      const newInstances = [] as InsertWrapper['records'];
      for (const el of instances) {
        if (el.value === null || el.value === undefined) {
          continue;
        } else if (Array.isArray(el.value)) {
          const name = el.stack[el.stack.length - 1].name;
          for (const sel of el.value) {
            newInstances.push({
              stack: el.stack,
              value: {
                [name]: sel
              }
            });
          }
        } else {
          newInstances.push(el);
        }
      }
      instances = newInstances;
    }

    if (!instances.length) {
      return;
    }

    const matrix = instances.map(inst => columns.map(c => this.resolveValue(c, inst.value[c.name])));

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
        matrix[i].push(this.hash(`${SQLUtil.buildPath(elStack)}${isArray ? `[${i + idx}]` : ''}`));
        matrix[i].push(this.hash(SQLUtil.buildPath(elStack.slice(0, elStack.length - 1))));
        if (isArray) {
          matrix[i].push(this.resolveValue(this.idxField, i + idx));
        }
      } else {
        matrix[i].push(this.hash(SQLUtil.buildPath(elStack)));
      }
    }

    return `
INSERT INTO ${this.table(stack)} (${columnNames.map(this.ident).join(', ')})
VALUES
${matrix.map(row => `(${row.join(', ')})`).join(',\n')};`;
  }

  /**
   * Get ALL Insert queries as needed
   */
  getAllInsertSQL<T>(cls: Class<T>, instance: T): string[] {
    const out: string[] = [];
    const add = (text?: string) => text && out.push(text);
    SQLUtil.visitSchemaInstance(cls, instance, {
      onRoot: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }])),
      onSub: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }])),
      onSimple: ({ value, path }) => add(this.getInsertSQL(path, [{ stack: path, value }]))
    });
    return out;
  }

  /**
   * Simple data base updates
   */
  getUpdateSQL(stack: VisitStack[], data: any, where?: WhereClause<any>) {
    const { type } = stack[stack.length - 1];
    const { localMap } = SQLUtil.getFieldsByLocation(stack);
    return `
UPDATE ${this.table(stack)}
SET
  ${Object
        .entries(data)
        .filter(([k]) => k in localMap)
        .map(([k, v]) => `${this.ident(k)}=${this.resolveValue(localMap[k], v)}`).join(', ')}
  ${this.getWhereSQL(type, where)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<any>) {
    const { type } = stack[stack.length - 1];
    return `
DELETE
FROM ${this.table(stack)} ${this.rootAlias}
${this.getWhereSQL(type, where)};`;
  }

  /**
  * Get elements by ids
  */
  getSelectRowsByIdsSQL(stack: VisitStack[], ids: string[], select: FieldConfig[] = []): string {
    const config = stack[stack.length - 1];
    const orderBy = !config.array ?
      '' :
      `ORDER BY ${this.rootAlias}.${this.idxField.name} ASC`;

    const idField = (stack.length > 1 ? this.parentPathField : this.idField);

    return `
SELECT ${select.length ? select.map(x => this.alias(x)).join(',') : '*'}
FROM ${this.table(stack)} ${this.rootAlias}
WHERE ${this.alias(idField)} IN (${ids.map(id => this.resolveValue(idField, id)).join(', ')})
${orderBy};`;
  }

  /**
   * Get COUNT(1) query
   */
  getQueryCountSQL<T>(cls: Class<T>, query: Query<T>) {
    return `
SELECT COUNT(DISTINCT ${this.rootAlias}.id) as total
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, query.where)}`;
  }

  async fetchDependents<T>(cls: Class<T>, items: T[], select?: SelectClause<T>): Promise<T[]> {
    const stack: Record<string, any>[] = [];
    const selectStack: (SelectClause<T> | undefined)[] = [];

    const buildSet = (children: any[], field?: any) => SQLUtil.collectDependents(this, stack[stack.length - 1], children, field);

    await SQLUtil.visitSchema(SchemaRegistry.get(cls), {
      onRoot: async (config) => {
        const res = buildSet(items); // Already filtered by initial select query
        selectStack.push(select);
        stack.push(res);
        await config.descend();
      },
      onSub: async ({ config, descend, fields, path }) => {
        const top = stack[stack.length - 1];
        const ids = Object.keys(top);
        const selectTop = selectStack[selectStack.length - 1];
        // @ts-ignore
        const subSelectTop: SelectClause<T> | undefined = selectTop?.[config.name];

        // See if a selection exists at all
        const sel: FieldConfig[] = subSelectTop ? fields
          .filter(f => subSelectTop[f.name as keyof SelectClause<T>] === 1)
          : [];

        if (sel.length) {
          sel.push(this.pathField, this.parentPathField);
          if (config.array) {
            sel.push(this.idxField);
          }
        }

        // If children and selection exists
        if (ids.length && (!subSelectTop || sel)) {
          const { records: children } = await this.executeSQL<any[]>(this.getSelectRowsByIdsSQL(
            path,
            ids,
            sel
          ));

          const res = buildSet(children, config);
          try {
            stack.push(res);
            selectStack.push(subSelectTop);
            await descend();
          } finally {
            selectStack.pop();
            stack.pop();
          }
        }
      },
      onSimple: async ({ config, path }) => {
        const top = stack[stack.length - 1];
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
  async deleteByIds(stack: VisitStack[], ids: string[]) {
    return this.deleteAndGetCount(stack[stack.length - 1].type, {
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
  async bulkProcess(dels: DeleteWrapper[], inserts: InsertWrapper[], upserts: InsertWrapper[], updates: InsertWrapper[]): Promise<BulkResponse> {
    const out = {
      counts: {
        delete: dels.reduce((acc, el) => acc + el.ids.length, 0),
        error: 0,
        insert: inserts.filter(x => x.stack.length === 1).reduce((acc, el) => acc + el.records.length, 0),
        update: updates.filter(x => x.stack.length === 1).reduce((acc, el) => acc + el.records.length, 0),
        upsert: upserts.filter(x => x.stack.length === 1).reduce((acc, el) => acc + el.records.length, 0)
      },
      errors: [],
      insertedIds: new Map()
    };

    // Full removals
    await Promise.all(dels.map(el => this.deleteByIds(el.stack, el.ids)));

    // Adding deletes
    if (upserts.length || updates.length) {
      const idx: any = this.idField.name;

      await Promise.all([
        ...upserts.filter(x => x.stack.length === 1).map(i =>
          this.deleteByIds(i.stack, i.records.map(v => v.value[idx]))
        ),
        ...updates.filter(x => x.stack.length === 1).map(i =>
          this.deleteByIds(i.stack, i.records.map(v => v.value[idx]))
        ),
      ]);
    }

    // Adding
    for (const items of [inserts, upserts, updates]) {
      if (!items.length) {
        continue;
      }
      let lvl = 1; // Add by level
      for (; ;) { // Loop until done
        const leveled = items.filter(f => f.stack.length === lvl);
        if (!leveled.length) {
          break;
        }
        await Promise.all(leveled
          .map(iw => this.getInsertSQL(iw.stack, iw.records))
          .filter(sql => !!sql)
          .map(sql => this.executeSQL(sql!)));
        lvl += 1;
      }
    }

    return out;
  }
}