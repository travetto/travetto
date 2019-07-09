import { Class } from '@travetto/registry';
import { SchemaRegistry, FieldConfig, BindUtil, SchemaChangeEvent, ALL_VIEW } from '@travetto/schema';
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

  async handleFieldChange(e: SchemaChangeEvent): Promise<void> {
    const root = e.cls;

    function pathToStack(path: string[]) {
      const out: VisitStack[] = SQLUtil.classToStack(root)
      let top = SchemaRegistry.get(root);

      for (const el of path) {
        const field = top.views[ALL_VIEW].schema[el];
        out.push(field);
        if (!SchemaRegistry.has(field.type)) {
          break;
        }
        top = SchemaRegistry.get(field.type);
      }

      return out;
    }

    const removes = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path, ev.prev!.name]));
      return acc;
    }, [] as string[][]);

    const modifies = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .map(ev => [...v.path, ev.prev!.name]));
      return acc;
    }, [] as string[][]);

    const adds = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'added')
        .map(ev => [...v.path, ev.curr!.name]));
      return acc;
    }, [] as string[][]);

    await Promise.all(removes.map(v => this.executeSQL(this.getDropColumnSQL(pathToStack(v)))));
    await Promise.all(adds.map(v => this.executeSQL(this.getAddColumnSQL(pathToStack(v)))));
    await Promise.all(modifies.map(v => this.executeSQL(this.getModifyColumnSQL(pathToStack(v)))));
  }

  getDropColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.namespaceParent(stack)} DROP COLUMN ${field.name}`;
  }

  getAddColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.namespaceParent(stack)} ADD COLUMN ${this.getColumnDefinition(field as FieldConfig)}`;
  }

  getModifyColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.namespaceParent(stack)} MODIFY COLUMN ${this.getColumnDefinition(field as FieldConfig)}`;
  }

  generateId(): string {
    return Util.uuid(this.KEY_LEN);
  }

  namespace(stack: VisitStack[]) {
    return `${this.ns}_${SQLUtil.buildTable(stack)}`;
  }

  namespaceParent(stack: VisitStack[]) {
    return this.namespace(stack.slice(0, stack.length - 1));
  }

  getKey(cls: Class, name: string) {
    return `${cls.name}:${name}`;
  }

  resolveName(stack: VisitStack[]): string {
    const path = this.namespaceParent(stack);
    const name = stack[stack.length - 1].name;
    const cache = SQLUtil.getAliasCache(stack, this.namespace);
    const base = cache.get(path)!;
    return `${base.alias}.${name}`;
  }

  getWhereFieldSQL<T>(stack: VisitStack[], o: Record<string, any>): any {
    const items = [];
    const { foreignMap, localMap } = SQLUtil.getFieldsByLocation(stack);

    for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
      const top = o[key];
      const field = localMap[key] || foreignMap[key];
      if (!field) {
        throw new Error(`Unknown field: ${key}`);
      }
      const sStack = [...stack, field];
      const sPath = this.resolveName(sStack);

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.getWhereFieldSQL(sStack, top);
          items.push(inner);
        } else {
          const v = top[subKey];
          const resolve = this.resolveValue.bind(null, field);

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
        items.push(`${sPath} ${SQL_OPS.$eq} ${this.resolveValue(field, top)}`);
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
      return this.getWhereFieldSQL(SQLUtil.classToStack(cls), o);
    }
  }

  getWhereSQL<T>(cls: Class<T>, where?: WhereClause<T>): string {
    return !where || !Object.keys(where).length ?
      '' :
      `WHERE ${this.getWhereGroupingSQL(cls, where)}`;
  }

  getOrderBySQL<T>(cls: Class<T>, sortBy?: SortClause<T>[]): string {
    return !sortBy ?
      '' :
      `ORDER BY ${SQLUtil.orderBy(cls, sortBy).map((ob) => {
        return `${this.resolveName(ob.stack)} ${ob.asc ? 'ASC' : 'DESC'}`
      }).join(', ')}`;
  }

  getSelectSQL<T>(cls: Class<T>, select?: SelectClause<T>): string {
    const stack = SQLUtil.classToStack(cls);
    const columns = select && SQLUtil.select(cls, select).map((sel) => this.resolveName([...stack, sel]));
    if (columns) {
      columns.unshift(`${this.rootAlias}.${this.pathField.name}`);
    }
    return !columns ?
      `SELECT ${this.rootAlias}.* ` :
      `SELECT ${columns.join(',')}`
  }

  getFromSQL<T>(cls: Class<T>): string {
    const stack = SQLUtil.classToStack(cls);
    const aliases = SQLUtil.getAliasCache(stack, this.namespace);
    const tables = [...aliases.keys()].sort((a, b) => a.length - b.length) // Shortest first
    return `FROM ${tables.map((table, i) => {
      const { alias, path } = aliases.get(table)!;
      if (path.length === 1) {
        return `${table} ${alias}`;
      } else {
        const key = this.namespaceParent(path);
        let { alias: parentAlias } = aliases.get(key)!;
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

    const fields = SchemaRegistry.has(config.type) ?
      [...SQLUtil.getFieldsByLocation(stack).local] :
      (array ? [config as FieldConfig] : []);

    if (!parent) {
      let idField = fields.find(x => x.name === this.idField.name);
      if (!idField) {
        fields.push(idField = this.idField);
      }
    }

    const out = `
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
  FOREIGN KEY (${this.parentPathField.name}) REFERENCES ${this.namespaceParent(stack)}(${this.pathField.name}) ON DELETE CASCADE`},
  UNIQUE KEY (${ this.pathField.name})
);`;
    return parent ?
      out :
      out.replace(new RegExp(`(\\b${this.idField.name}.*)DEFAULT NULL`), (_, s) => `${s} NOT NULL`);
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
  getInsertSQL(stack: VisitStack[], instances: InsertWrapper['records']) {
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
        if (Array.isArray(el.value)) {
          let i = 0;
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

    const matrix = instances.map(inst => columns.map(c => this.resolveValue(c, inst.value[c.name])));

    columnNames.push(this.pathField.name);
    if (hasParent) {
      columnNames.push(this.parentPathField.name);
      if (isArray) {
        columnNames.push(this.idxField.name);
      }
    }

    const idx = config.index || 0;

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
INSERT INTO ${this.namespace(stack)} (${columnNames.join(', ')})
VALUES
${matrix.map(row => `(${row.join(', ')})`).join(',\n')};`;
  }

  /**
   * Simple data base updates
   */
  getUpdateSQL(stack: VisitStack[], data: any, where?: WhereClause<any>) {
    const { type } = stack[stack.length - 1];
    const { localMap } = SQLUtil.getFieldsByLocation(stack);
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

  async deleteByIds(stack: VisitStack[], ids: string[]) {
    return this.deleteAndGetCount(stack[stack.length - 1].type, {
      where: {
        [stack.length === 1 ? this.idField.name : this.pathField.name]: {
          $in: ids
        }
      }
    });
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
    await Promise.all(dels.map(el => this.deleteByIds(el.stack, el.ids)));

    // Adding deletes
    if (upserts.length || updates.length) {
      const idx: any = this.idField.name;

      await Promise.all([
        ...upserts.filter(x => x.stack.length === 1).map(i => {
          return this.deleteByIds(i.stack, i.records.map(v => v.value[idx]));
        }),
        ...updates.filter(x => x.stack.length === 1).map(i => {
          return this.deleteByIds(i.stack, i.records.map(v => v.value[idx]));
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