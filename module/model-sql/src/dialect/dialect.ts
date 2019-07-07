import { Class } from '@travetto/registry';
import { SchemaRegistry, FieldConfig, BindUtil, SchemaChangeEvent } from '@travetto/schema';
import { Util } from '@travetto/base';
import { SelectClause, Query, SortClause, WhereClause } from '@travetto/model';

import { SQLUtil, VisitStack } from '../util';
import { Dialect, DeleteWrapper, InsertWrapper } from '../types';
import { BulkResponse } from '@travetto/model/src/model/bulk';

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;

const SQL_OPS = {
  $and: ' AND ',
  $or: ' OR ',
  $not: 'NOT ',
  $all: 'ALL =',
  $regex: 'REGEXP',
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

export abstract class SQLDialect implements Dialect {
  KEY_LEN = 64;

  idField = makeField('id', String, true, {
    maxlength: { n: 32 },
    minlength: { n: 32 }
  });

  idxField = makeField('__idx', Number, true, {});

  parentPathField = makeField('__parent_path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  pathField = makeField('__path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  constructor() {
    this.namespace = this.namespace.bind(this);
  }

  get rootAlias() {
    return SQLUtil.ROOT_ALIAS;
  }

  abstract get conn(): any;

  abstract getColumnDefinition(field: FieldConfig): string;

  abstract get ns(): string;

  abstract hash(inp: string): string;

  abstract executeSQL<T>(sql: string): Promise<T>;

  abstract resolveValue(config: FieldConfig, value: any): string;

  abstract deleteAndGetCount<T>(cls: Class<T>, query: Query<T>): Promise<number>;

  abstract getCountForQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;

  handleFieldChange?(ev: SchemaChangeEvent): Promise<void>;

  bulkProcess?(
    dels: DeleteWrapper[],
    inserts: InsertWrapper[],
    upserts: InsertWrapper[],
    updates: InsertWrapper[]
  ): Promise<BulkResponse>;

  generateId(): string {
    return Util.uuid(this.KEY_LEN);
  }

  namespace(stack: VisitStack[]) {
    return `${this.ns}_${SQLUtil.buildTable(stack)}`;
  }

  getKey(cls: Class, name: string) {
    return `${cls.name}:${name}`;
  }

  resolveName(type: Class, field?: string): string {
    let base = SQLUtil.getAliasCache(type, this.namespace).get(type)!.alias;
    return field ? `${base}.${field}` : base;
  }

  getWhereFieldSQL<T>(cls: Class<T>, o: Record<string, any>, path: string = ''): any {
    const items = [];
    const schema = SchemaRegistry.getViewSchema(cls).schema;

    const tPath = path ? `${path}_${cls.name.toLowerCase()}` : cls.name.toLowerCase();

    for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
      const top = o[key];
      const declaredSchema = schema[key];
      const declaredType = declaredSchema.type;
      const sPath = this.resolveName(declaredSchema.owner, declaredSchema.name);

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.getWhereFieldSQL(declaredType as Class<any>, top, tPath);
          items.push(inner);
        } else {
          const v = top[subKey];
          const resolve = this.resolveValue.bind(null, declaredSchema);

          switch (subKey) {
            case '$all': case '$nin': case '$in': {
              const arr = (Array.isArray(v) ? v : [v]).map(el => resolve(el));
              items.push(`${sPath} ${SQL_OPS[subKey]} (${arr})`);
              break;
            }
            case '$regex': {
              const re = (v as RegExp)
              const src = BindUtil.extractRegex(re).source;
              const ins = re.flags && re.flags.includes('i');

              if (/^[\^]\S+[.][*][$]?$/.test(src)) {
                const inner = src.substring(1, src.length - 2);
                items.push(`${sPath} ${ins ? SQL_OPS.$ilike : SQL_OPS.$like} ${resolve(inner)}%`);
              } else {
                let val = resolve(v);
                items.push(`${sPath} ${SQL_OPS[subKey]} ${!ins ? 'BINARY' : ''} ${val}`);
              }
              break;
            }
            case '$exists': items.push(`${sPath} ${v ? SQL_OPS.$isNot : SQL_OPS.$is} NULL`); break;
            case '$ne': case '$eq': items.push(`${sPath} ${SQL_OPS[subKey]} ${resolve(v)}`); break;
            case '$lt': case '$gt': case '$gte': case '$lte': {
              const subItems = (Object.keys(top) as (keyof typeof SQL_OPS)[])
                .map(ssk => `${sPath} ${SQL_OPS[ssk]} ${resolve(top[ssk])}`);
              items.push(subItems.length > 1 ? `(${subItems.join(SQL_OPS.$and)})` : subItems[0]);
              break;
            }
            case '$geoWithin':
              items.push({
                geo_polygon: {
                  [sPath]: {
                    points: v.map(([lat, lon]: [number, number]) => ({ lat, lon }))
                  }
                }
              });
              break;
            case '$geoIntersects':
              items.push({
                geo_shape: {
                  [sPath]: {
                    type: 'envelope',
                    coordinates: v
                  },
                  relation: 'within'
                }
              });
              break;
          }
        }
        // Handle operations
      } else {
        items.push(`${sPath} ${SQL_OPS.$eq} ${this.resolveValue(declaredSchema, top)}`);
      }
    }
    if (items.length === 1) {
      return items[0];
    } else {
      return `(${items.join(SQL_OPS.$and)})`;
    }
  }

  getWhereGroupingSQL<T>(cls: Class<T>, o: WhereClause<T>): string {
    if (has$And(o)) {
      return `(${o.$and.map(x => this.getWhereGroupingSQL<T>(cls, x)).join(SQL_OPS.$and)})`;
    } else if (has$Or(o)) {
      return `(${o.$or.map(x => this.getWhereGroupingSQL<T>(cls, x)).join(SQL_OPS.$or)})`;
    } else if (has$Not(o)) {
      return `NOT (${this.getWhereGroupingSQL<T>(cls, o.$not)})`;
    } else {
      return this.getWhereFieldSQL(cls, o);
    }
  }

  getWhereSQL<T>(cls: Class<T>, where?: WhereClause<T>): string {
    return !where ?
      '' :
      `WHERE ${this.getWhereGroupingSQL(cls, where)}`;
  }

  getOrderBySQL<T>(cls: Class<T>, sortBy?: SortClause<T>[]): string {
    return !sortBy ?
      '' :
      `ORDER BY ${SQLUtil.orderBy(cls, sortBy).map((ob) => {
        return `${this.resolveName(ob.type, ob.field)} ${ob.asc ? 'ASC' : 'DESC'}`
      }).join(', ')}`;
  }

  getSelectSQL<T>(cls: Class<T>, select?: SelectClause<T>): string {
    return !select ?
      'SELECT * ' :
      `SELECT ${SQLUtil.select(cls, select).map((sel) => this.resolveName(sel.type, sel.field)).join(', ')}`
  }

  getFromSQL<T>(cls: Class<T>): string {
    const aliases = SQLUtil.getAliasCache(cls, this.namespace);
    const classes = [cls, ...aliases.keys()];
    return `FROM ${classes.map((x, i) => {
      const { alias, parent, table } = aliases.get(x)!;

      if (!parent) {
        return `${table} ${alias}`;
      } else {
        let { alias: parentAlias } = aliases.get(parent)!;
        return `  LEFT OUTER JOIN ${table} ${alias} ON\n    ${alias}.${this.parentPathField.name} = ${parentAlias}.${this.pathField.name}\n`;
      }
    }).join('\n')}`
  }

  getLimitSQL<T>(cls: Class<T>, query?: Query<T>): string {
    return !query || (!query.limit && !query.offset) ?
      '' :
      `LIMIT ${query.offset || 0}, ${query.limit}`;
  }

  getQuerySQL<T>(cls: Class<T>, query: Query<T>) {
    return `
${this.getSelectSQL(cls, query.select)}
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, query.where)}
${this.getOrderBySQL(cls, query.sort)}
${this.getLimitSQL(cls, query)}`;
  }

  getCreateTableSQL(stack: VisitStack[]) {
    const { config, type } = stack[stack.length - 1];
    const parent = stack.length > 1;
    const array = parent && (config as FieldConfig).array;

    const fields = SchemaRegistry.has(type) ?
      [...SQLUtil.getFieldsByLocation(type).local] :
      (array ? [config as FieldConfig] : []);

    if (!parent) {
      let idField = fields.find(x => x.name === this.idField.name);
      if (!idField) {
        fields.push(idField = this.idField);
      }
    }

    return `
CREATE TABLE IF NOT EXISTS ${this.namespace(stack)} (
  ${fields
        .map(f => this.getColumnDefinition(f))
        .filter(x => !!x.trim())
        .join(',\n  ')},
  ${this.getColumnDefinition(this.pathField)}
  ${!parent ? '' :
        `, ${this.getColumnDefinition(this.parentPathField)}, 
    ${array ? `${this.getColumnDefinition(this.idxField)},` : ''}
  PRIMARY KEY (${this.pathField.name}, ${this.parentPathField.name}),
  FOREIGN KEY (${this.parentPathField.name}) REFERENCES ${this.namespace(stack.slice(0, stack.length - 1))}(${this.pathField.name}) ON DELETE CASCADE`},
  UNIQUE KEY (${ this.pathField.name})
);`.replace(new RegExp(`(\\b${this.idField.name}.*)DEFAULT NULL`), (_, s) => `${s} NOT NULL`);
  }

  /**
  * Simple table drop
  */
  getDropTableSQL(stack: VisitStack[]) {
    return `DROP TABLE IF EXISTS ${this.namespace(stack)}; `;
  }

  /**
   * Simple insertion
   */
  getInsertSQL(stack: VisitStack[], instances: any[], idxOffset: number = 0) {
    const { type, config } = stack[stack.length - 1];
    const columns = SQLUtil.getFieldsByLocation(type).local
      .filter(x => !SchemaRegistry.has(x.type) && !x.array)
      .sort((a, b) => a.name.localeCompare(b.name));

    const hasParent = 'type' in config;
    const isArray = 'array' in config && config.array;

    const columnNames = columns.map(c => c.name);
    const matrix = instances.map(inst => columns.map(c => this.resolveValue(c, inst[c.name])));

    if (hasParent) {
      columnNames.unshift(this.parentPathField.name);
    }
    columnNames.unshift(this.pathField.name);
    if (isArray) {
      columnNames.unshift(this.idxField.name);
    }

    for (let i = 0; i < matrix.length; i++) {
      if (hasParent) {
        matrix[i].unshift(SQLUtil.buildPath(stack.slice(0, stack.length - 1)));
      }
      matrix[i].unshift(`${SQLUtil.buildPath(stack)}${isArray ? `[${i + idxOffset}]` : ''}`);
      if (isArray) {
        matrix[i].unshift(this.resolveValue(this.idxField, i + idxOffset));
      }
    }

    return `
INSERT INTO ${this.namespace(stack)} (${columnNames.join(', ')})
VALUES
${matrix.map(row => `(${row.join(', ')})`).join(',\n')};`;
  }

  /**
   * Simple data base updates
   */
  getUpdateSQL(stack: VisitStack[], data: any, suffix?: string) {
    const { type } = stack[stack.length - 1];
    const { localMap } = SQLUtil.getFieldsByLocation(type);
    return `
UPDATE ${this.namespace(stack)} 
SET
  ${Object
        .entries(data)
        .filter(([k]) => k in localMap)
        .map(([k, v]) => `${k}=${this.resolveValue(localMap[k], v)}`).join(', ')}
  ${suffix};`;
  }

  getDeleteByIdsSQL(stack: VisitStack[], ids: string[]) {
    return `
DELETE 
FROM ${this.namespace(stack)} 
WHERE ${this.idField.name} IN (${ids.map(id => this.resolveValue(this.idField, id)).join(', ')});`;
  }


  /**
  * Get elements by ids
  */
  getSelectRowsByIdsSQL<T>(cls: Class<T>, stack: VisitStack[], ids: string[], select: FieldConfig[] = []): string {
    const { config } = stack[stack.length - 1];
    const orderBy = !('array' in config && config.array) ?
      '' :
      `ORDER BY ${this.rootAlias}.${this.idxField.name} ASC`;

    return `
SELECT ${select.length ? select.map(x => `${this.rootAlias}.${x.name}`).join(',') : '*'}
FROM ${this.namespace(stack)} ${this.rootAlias}
WHERE ${this.rootAlias}.${('type' in config ? this.pathField : this.idField.name)} IN (${ids.map(id => `'${id}'`).join(', ')})
${orderBy};`;
  }
}