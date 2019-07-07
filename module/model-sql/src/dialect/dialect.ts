import { Class } from '@travetto/registry';
import { SchemaRegistry, FieldConfig, BindUtil, SchemaChangeEvent } from '@travetto/schema';
import { Util } from '@travetto/base';
import { BulkResponse, SelectClause, Query, SortClause, WhereClause } from '@travetto/model';

import { SQLUtil, VisitStack } from '../util';
import { Dialect, DeleteWrapper, InsertWrapper } from '../types';

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
      `SELECT ${this.rootAlias}.* ` :
      `SELECT ${SQLUtil.select(cls, select).map((sel) => this.resolveName(sel.type, sel.field)).join(', ')}`
  }

  getFromSQL<T>(cls: Class<T>): string {
    const aliases = SQLUtil.getAliasCache(cls, this.namespace);
    const classes = [...aliases.keys()].sort((a, b) => a === cls ? -1 : 1)
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

  getGroupBySQL<T>(cls: Class<T>, query?: Query<T>): string {
    return `GROUP BY ${this.rootAlias}.${this.idField.name}`;
  }

  getQuerySQL<T>(cls: Class<T>, query: Query<T>) {
    return `
${this.getSelectSQL(cls, query.select)}
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, query.where)}
${this.getGroupBySQL(cls, query)}
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
  ${this.getColumnDefinition(this.pathField)},
  ${!parent ?
        `PRIMARY KEY (${this.idField.name})` :
        `${this.getColumnDefinition(this.parentPathField)}, 
    ${array ? `${this.getColumnDefinition(this.idxField)},` : ''}
  PRIMARY KEY (${this.pathField.name}),
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
  getInsertSQL(stack: VisitStack[], instances: [VisitStack[], any][]) {
    const { type, config, index } = stack[stack.length - 1];
    const columns = SQLUtil.getFieldsByLocation(type).local
      .filter(x => !SchemaRegistry.has(x.type) && !x.array)
      .sort((a, b) => a.name.localeCompare(b.name));

    const hasParent = 'type' in config;
    const isArray = 'array' in config && config.array;

    const columnNames = columns.map(c => c.name);
    const matrix = instances.map(inst => columns.map(c => this.resolveValue(c, inst[1][c.name])));

    columnNames.push(this.pathField.name);
    if (hasParent) {
      columnNames.push(this.parentPathField.name);
      if (isArray) {
        columnNames.push(this.idxField.name);
      }
    }

    const idx = index || 0;

    for (let i = 0; i < matrix.length; i++) {
      const [elStack] = instances[i];
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
INSERT INTO ${this.namespace(stack)} (${columnNames.join(', ')})
VALUES
${matrix.map(row => `(${row.join(', ')})`).join(',\n')};`;
  }

  /**
   * Simple data base updates
   */
  getUpdateSQL(stack: VisitStack[], data: any, where?: WhereClause<any>) {
    const { type } = stack[stack.length - 1];
    const { localMap } = SQLUtil.getFieldsByLocation(type);
    return `
UPDATE ${this.namespace(stack)} 
SET
  ${Object
        .entries(data)
        .filter(([k]) => k in localMap)
        .map(([k, v]) => `${k}=${this.resolveValue(localMap[k], v)}`).join(', ')}
  ${this.getWhereSQL(type, where)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<any>) {
    const { type } = stack[stack.length - 1];
    return `
DELETE ${this.rootAlias}
FROM ${this.namespace(stack)} ${this.rootAlias}
${this.getWhereSQL(type, where)};`;
  }

  getDeleteByIdsSQL(stack: VisitStack[], ids: string[]) {
    return this.getDeleteSQL(stack, {
      [stack.length > 1 ? this.pathField.name : this.idField.name]: {
        $in: ids
      }
    });
  }

  /**
  * Get elements by ids
  */
  getSelectRowsByIdsSQL<T>(stack: VisitStack[], ids: string[], select: FieldConfig[] = []): string {
    const { config } = stack[stack.length - 1];
    const orderBy = !('array' in config && config.array) ?
      '' :
      `ORDER BY ${this.rootAlias}.${this.idxField.name} ASC`;

    const idField = ('type' in config ? this.pathField : this.idField);

    return `
SELECT ${select.length ? select.map(x => `${this.rootAlias}.${x.name}`).join(',') : '*'}
FROM ${this.namespace(stack)} ${this.rootAlias}
WHERE ${this.rootAlias}.${idField.name} IN (${ids.map(id => this.resolveValue(idField, id)).join(', ')})
${orderBy};`;
  }

  getQueryCountSQL<T>(cls: Class<T>, query: Query<T>) {
    return `
SELECT COUNT(1) as total
${this.getFromSQL(cls)}
${this.getWhereSQL(cls, query.where)}
${this.getGroupBySQL(cls, query)}`;
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
        const selectTop = selectStack[selectStack.length - 1] as any;
        const subSelectTop = selectTop ? selectTop[config.name] : undefined;

        // See if a selection exists at all
        const sel: FieldConfig[] = subSelectTop ? fields
          .filter(f => (subSelectTop as any)[f.name] === 1)
          : [];

        if (sel.length) {
          sel.push(this.pathField, this.parentPathField);
          if (config.array) {
            sel.push(this.idxField);
          }
        }

        // If children and selection exists
        if (ids.length && (!subSelectTop || sel)) {
          const children = await this.executeSQL<any[]>(this.getSelectRowsByIdsSQL(
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
          const matching = await this.executeSQL<any[]>(this.getSelectRowsByIdsSQL(
            path,
            ids
          ));
          buildSet(matching, config);
        }
      }
    });

    return items;
  }

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
    await Promise.all(dels.map(el => this.executeSQL(this.getDeleteByIdsSQL(el.stack, el.ids))));

    // Adding deletes
    if (upserts.length || updates.length) {
      const idx: any = this.idField.name;

      await Promise.all([
        ...upserts.filter(x => x.stack.length === 1).map(i => {
          return this.executeSQL(this.getDeleteByIdsSQL(i.stack, i.records.map(v => v[idx])))
        }),
        ...updates.filter(x => x.stack.length === 1).map(i => {
          return this.executeSQL(this.getDeleteByIdsSQL(i.stack, i.records.map(v => v[idx])));
        }),
      ]);
    }

    // Adding
    for (const items of [inserts, upserts, updates]) {
      if (!items.length) {
        continue;
      }
      let lvl = 1; // Add by level
      while (true) {
        const leveled = items.filter(f => f.stack.length === lvl);
        if (!leveled.length) {
          break;
        }
        await Promise.all(leveled.map(iw => this.executeSQL(this.getInsertSQL(iw.stack, iw.records))))
        lvl += 1;
      }
    }

    return out;
  }
}