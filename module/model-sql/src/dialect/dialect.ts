import { Class } from '@travetto/registry';
import { SchemaRegistry, FieldConfig, ALL_VIEW, ClassConfig, BindUtil } from '@travetto/schema';
import { Util } from '@travetto/base';
import { SelectClause, Query, SortClause, WhereClause } from '@travetto/model';

import { SQLUtil, VisitStack } from '../util';

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

export abstract class SQLDialect {
  KEY_LEN = 64;

  rootAlias = '_root';

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

  abstract getColumnDefinition(field: FieldConfig): string;

  abstract get ns(): string;

  namespace(name: string | VisitStack[]) {
    return `${this.ns}_${typeof name === 'string' ? name : SQLUtil.buildTable(name)}`;
  }

  getKey(cls: Class, name: string) {
    return `${cls.name}:${name}`;
  }

  resolveName(type: Class, field?: string): string {
    let base = SQLUtil.getAliasCache(type, this.namespace).get(type)!.alias;
    return field ? `${base}.${field}` : base;
  }

  abstract resolveValue(config: FieldConfig, value: any): string;

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
      SQLUtil.getFieldsByLocation(type).local :
      (array ? [config as FieldConfig] : []);

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
}