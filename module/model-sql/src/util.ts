import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelCore, WhereClause, SelectClause, SortClause } from '@travetto/model';
import { SchemaRegistry, ClassConfig, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { Dialect, InsertWrapper } from './types';

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

export type VisitState = { path: string[], parentTable?: string };

interface VisitNode {
  path: string[];
  table: string;
  index?: number;
  fields: FieldConfig[];
  parentTable?: string;
  descend: () => Promise<any>;
}

export interface VisitInstanceNode extends VisitNode {
  value: any;
}

export interface VisitHandler<R, U extends VisitNode = VisitNode> {
  onRoot(config: U & { config: ClassConfig }): R;
  onSub(config: U & { config: FieldConfig, parentTable: string }): R;
  onSimple(config: U & { config: FieldConfig, parentTable: string }): R;
}

export class SQLUtil {
  static fromMappingCache = new Map<Class, Record<string, { alias: string, where?: string }>>();
  static schemaFieldsCache = new Map<Class, {
    local: FieldConfig[],
    localMap: Record<string, FieldConfig>,
    foreign: FieldConfig[],
    foreignMap: Record<string, FieldConfig>
  }>();

  static extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
    const out: { [key: string]: any } = {};
    const sub = o as { [key: string]: any };
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subPath = `${path}${key}`;
      if (Util.isPlainObject(sub[key]) && !Object.keys(sub[key])[0].startsWith('$')) {
        Object.assign(out, this.extractSimple(sub[key], `${subPath}.`));
      } else {
        out[subPath] = sub[key];
      }
    }
    return out;
  }

  static cleanResults<T>(dct: Dialect, o: T): T {
    if (Array.isArray(o)) {
      return o.filter(x => x !== null && x !== undefined).map(x => this.cleanResults(dct, x)) as any;
    } else if (!Util.isSimple(o)) {
      for (const k of Object.keys(o) as (keyof T)[]) {
        if (o[k] === null || o[k] === undefined || k === dct.parentPathField.name || k === dct.pathField.name || k === dct.idxField.name) {
          delete o[k];
        } else {
          o[k] = this.cleanResults(dct, o[k]);
        }
      }
      return { ...o };
    } else {
      return o;
    }
  }

  static getSort<T>(sort: SortClause<T>[]) {
    return sort.map(x => {
      const o = this.extractSimple(x);
      const k = Object.keys(o)[0];
      const v = o[k] as (boolean | -1 | 1);
      if (v === 1 || v === true) {
        return k;
      } else {
        return `${k}:desc`;
      }
    });
  }

  static buildWhereField<T>(dct: Dialect, cls: Class<T>, o: Record<string, any>, aliases?: Record<string, string>, path: string = ''): any {
    const items = [];
    const schema = SchemaRegistry.getViewSchema(cls).schema;

    const tPath = path ? `${path}_${cls.name.toLowerCase()}` : cls.name.toLowerCase();

    for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
      const top = o[key];
      const declaredSchema = schema[key];
      const declaredType = declaredSchema.type;
      const sPath = `${dct.resolveTable(cls, path, aliases)}.${key}`;

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.buildWhereField(dct, declaredType as Class<any>, top, aliases, tPath);
          items.push(inner);
        } else {
          const v = top[subKey];
          const resolve = dct.resolveValue.bind(null, declaredSchema);

          switch (subKey) {
            case '$all': case '$nin': case '$in': {
              const arr = (Array.isArray(v) ? v : [v]).map(el => resolve(el));
              items.push(`${sPath} ${SQL_OPS[subKey]} (${arr})`);
              break;
            }
            case '$regex': {
              const re = (v as RegExp)
              const src = re.source;
              const ins = re.flags && re.flags.includes('i');

              if (/^[\^]\S+[.][*][$]?$/.test(src)) {
                const inner = src.substring(1, src.length - 2);
                items.push(`${sPath} ${ins ? SQL_OPS.$ilike : SQL_OPS.$like} ${resolve(inner)}%`);
              } else {
                let val = resolve(v).replace(/\\b/g, '([[:<:]]|[[:>:]])');
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
        items.push(`${sPath} ${SQL_OPS.$eq} ${dct.resolveValue(declaredSchema, top)}`);
      }
    }
    if (items.length === 1) {
      return items[0];
    } else {
      return `(${items.join(SQL_OPS.$and)})`;
    }
  }

  static buildWhere<T>(dct: Dialect, o: WhereClause<T>, cls: Class<T>, aliases?: Record<string, string>): string {
    if (has$And(o)) {
      return `(${o.$and.map(x => this.buildWhere<T>(dct, x, cls, aliases)).join(SQL_OPS.$and)})`;
    } else if (has$Or(o)) {
      return `(${o.$or.map(x => this.buildWhere<T>(dct, x, cls, aliases)).join(SQL_OPS.$or)})`;
    } else if (has$Not(o)) {
      return `NOT (${this.buildWhere<T>(dct, o.$not, cls, aliases)})`;
    } else {
      return this.buildWhereField(dct, cls, o, aliases);
    }
  }

  static getFieldsByLocation(cls: Class | ClassConfig) {
    if (!('views' in cls)) {
      cls = SchemaRegistry.get(cls);
    }
    if (this.schemaFieldsCache.has(cls.class)) {
      return this.schemaFieldsCache.get(cls.class)!;
    }
    const conf = cls.views[ALL_VIEW];
    const fields = conf.fields.map(x => conf.schema[x]);
    const ret = {
      localMap: {} as Record<string, FieldConfig>,
      foreignMap: {} as Record<string, FieldConfig>,
      local: fields.filter(x => !SchemaRegistry.has(x.type) && !x.array),
      foreign: fields.filter(x => SchemaRegistry.has(x.type) || x.array)
    };

    ret.local.reduce((acc, f) => (acc[f.name] = f) && acc, ret.localMap);
    ret.foreign.reduce((acc, f) => (acc[f.name] = f) && acc, ret.foreignMap);

    this.schemaFieldsCache.set(cls.class, ret);

    return ret;
  }

  static visitSchemaSync(
    dct: Dialect, config: ClassConfig | FieldConfig, handler: VisitHandler<void>,
    state: VisitState = { path: [], parentTable: '' }
  ) {
    const isRoot = 'class' in config;
    const type = 'class' in config ? config.class : config.type;
    const table = dct.resolveTable(type, state.parentTable);
    const { local: fields, foreign } = this.getFieldsByLocation(type);

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          this.visitSchemaSync(dct, field, handler, { path: state.path, parentTable: table });
        } else {
          handler.onSimple({
            ...state, config: field, parentTable: table, table: `${table}_${field.name}`, descend: null as any, fields: []
          });
        }
      }
    };

    try {
      if (!('class' in config)) {
        state.path.push(config.name);
      }

      if (isRoot) {
        return handler.onRoot({
          config: config as ClassConfig, table, fields, descend, ...state
        });
      } else if (!isRoot) {
        return handler.onSub({
          config: config as FieldConfig, table, fields, descend, ...state, parentTable: state.parentTable!
        });
      }

      return descend();
    } finally {
      state.path.pop();
    }
  }

  static async visitSchema(dct: Dialect, config: ClassConfig | FieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [], parentTable: '' }) {
    const isRoot = 'class' in config;
    const type = 'class' in config ? config.class : config.type;
    const table = dct.resolveTable(type, state.parentTable);
    const { local: fields, foreign } = this.getFieldsByLocation(type);

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          await this.visitSchema(dct, field, handler, { path: state.path, parentTable: table });
        } else {
          await handler.onSimple({
            ...state, config: field, parentTable: table, table: `${table}_${field.name}`, descend: null as any, fields: []
          });
        }
      }
    };

    try {
      if (!('class' in config)) {
        state.path.push(config.name);
      }

      if (isRoot) {
        return await handler.onRoot({
          config: config as ClassConfig, table, fields, descend, ...state
        });
      } else if (!isRoot) {
        return await handler.onSub({
          config: config as FieldConfig, table, fields, descend, ...state, parentTable: state.parentTable!
        });
      }

      return await descend();
    } finally {
      state.path.pop();
    }
  }

  static async visitSchemaInstance<T extends ModelCore>(dct: Dialect, cls: Class<T>, instance: T, handler: VisitHandler<Promise<any> | any, VisitInstanceNode>) {
    const pathObj: any[] = [instance];
    await this.visitSchema(dct, SchemaRegistry.get(cls), {
      onRoot: async (config) => {
        await handler.onRoot({ ...config, value: instance });
        return config.descend();
      },
      onSub: async (config) => {
        const { config: field } = config;
        const top = pathObj[pathObj.length - 1];
        if (field.name in top) {
          const value = top[field.name];
          const isArray = Array.isArray(value);
          const vals = isArray ? value : [value];
          let i = 0;
          for (const val of vals) {
            try {
              pathObj.push(val);
              let path = config.path;
              if (isArray) {
                const len = path.length;
                path = [...path.slice(0, len - 1), `${path[len - 1]}[${i}]`];
              }
              await handler.onSub({ ...config, value: val, path, index: i });
            } finally {
              pathObj.pop();
            }
            i += 1;
          }
          return config.descend();
        }
      },
      onSimple: (config) => {
        const { config: field } = config;
        const top = pathObj[pathObj.length - 1];
        const value = top[field.name];
        return handler.onSimple({ ...config, value });
      }
    }, {
        parentTable: '',
        path: [instance.id!]
      });
  }

  static buildSchemaToTableMapping<T>(dct: Dialect, cls: Class<T>) {
    if (this.fromMappingCache.has(cls)) {
      return this.fromMappingCache.get(cls)!;
    }

    const clauses: Record<string, { alias: string, where?: string }> = {};
    let idx = 0;

    this.visitSchemaSync(dct, SchemaRegistry.get(cls), {
      onRoot: ({ table, descend, config }) => {
        clauses[table] = {
          alias: dct.ROOT
        };
        return descend();
      },
      onSub: ({ table, descend, config, parentTable }) => {
        const alias = `${config.name.charAt(0)}${idx++}`;
        const where = `${clauses[parentTable].alias}.${dct.pathField.name} = ${alias}.${dct.parentPathField.name}`;
        clauses[table] = { alias, where };
        return descend();
      },
      onSimple: ({ table, config, parentTable }) => {
        const alias = `${config.name.charAt(0)}${idx++}`;
        const where = `${clauses[parentTable].alias}.${dct.pathField.name} = ${alias}.${dct.parentPathField.name}`;
        clauses[table] = { alias, where };
      }
    });

    this.fromMappingCache.set(cls, clauses);

    return clauses;
  }

  static collectDependents<T extends any>(dct: Dialect, parent: any, v: T[], field?: FieldConfig) {
    if (field) {
      const isSimple = SchemaRegistry.has(field.type);
      for (const el of v) {
        const root = parent[el[dct.parentPathField.name]];
        if (field.array) {
          if (!root[field.name]) {
            root[field.name] = [isSimple ? el : el[field.name]];
          } else {
            root[field.name].push(isSimple ? el : el[field.name]);
          }
        } else {
          root[field.name] = isSimple ? el : el[field.name];
        }
      }
    }

    const mapping: Record<string, T> = {};
    for (const el of v) {
      mapping[(el as any)[dct.pathField.name]] = el; field
    }
    return mapping;
  }

  static async fetchDependents<T>(
    dct: Dialect,
    cls: Class<T>, items: T[],
    select?: SelectClause<T>
  ): Promise<T[]> {
    const stack: Record<string, any>[] = [];
    const selectStack: (SelectClause<T> | undefined)[] = [];

    const buildSet = (children: any[], field?: any) => this.collectDependents(dct, stack[stack.length - 1], children, field);

    await this.visitSchema(dct, SchemaRegistry.get(cls), {
      onRoot: async (config) => {
        const res = buildSet(items); // Already filtered by initial select query
        selectStack.push(select);
        stack.push(res);
        await config.descend();
      },
      onSub: async ({ config, parentTable, table, descend, fields }) => {
        const top = stack[stack.length - 1];
        const ids = Object.keys(top);
        const selectTop = selectStack[selectStack.length - 1] as any;
        const subSelectTop = selectTop ? selectTop[config.name] : undefined;

        // See if a selection exists at all
        const sel = subSelectTop ? fields
          .filter(f => (subSelectTop as any)[f.name] === 1)
          .map(f => f.name)
          : [];

        if (sel.length) {
          sel.push(dct.pathField.name, dct.parentPathField.name);
          if (config.array) {
            sel.push(dct.idxField.name);
          }
        }

        // If children and selection exists
        if (ids.length && (!subSelectTop || sel)) {
          const children = await dct.selectRowsByIds(table, dct.parentPathField.name, ids, sel);

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
      onSimple: async ({ config, table }) => {
        const top = stack[stack.length - 1];
        const ids = Object.keys(top);
        if (ids.length) {
          const matching = await dct.selectRowsByIds(table, dct.parentPathField.name, ids, [], dct.sort(dct.idxField.name, true));
          buildSet(matching, config);
        }
      }
    });

    return items;
  }

  static async extractInserts<T>(dct: Dialect, cls: Class<T>, els: T[]): Promise<InsertWrapper[]> {
    const ins = {} as Record<string, InsertWrapper>;

    function track(table: string, fields: FieldConfig[], level: number, extra: string[]) {
      if (!ins[table]) {
        const fieldNames = fields.map(x => x.name);
        ins[table] = {
          table,
          level,
          fields: [...extra, ...fieldNames],
          records: []
        }
      }
    }

    const all = els.map(el =>
      this.visitSchemaInstance(dct, cls, el, {
        onRoot: ({ table, fields, path, value }) => {
          track(table, fields, path.length, [dct.pathField.name]);
          ins[table].records.push([dct.hash(path.join('.')), ...fields.map(f => dct.resolveValue(f, value[f.name]))]);
        },
        onSub: ({ table, fields, path, value }) => {
          track(table, fields, path.length, [dct.parentPathField.name, dct.pathField.name]);

          const parentPath = dct.hash(path.slice(0, path.length - 1).join('.'));
          const currentPath = dct.hash(`${path.join('.')}`);

          ins[table].records.push([
            parentPath, currentPath, ...fields.map(f => dct.resolveValue(f, value[f.name]))
          ]);
        },
        onSimple: async ({ table, config: field, path, value }) => {
          track(table, [field], path.length, [dct.parentPathField.name, dct.pathField.name]);

          const parentPath = dct.hash(path.slice(0, path.length - 1).join('.'));
          const currentPath = `${path.join('.')}`;

          ins[table].records.push(...value.map((v: any, i: number) => [
            parentPath, dct.hash(`${currentPath}[${i}]`), dct.resolveValue(field, v)
          ]));
        }
      }));

    await Promise.all(all);

    return [...Object.values(ins)];
  };

}