import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelCore, SelectClause, SortClause } from '@travetto/model';
import { SchemaRegistry, ClassConfig, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { Dialect, InsertWrapper } from './types';

export type VisitStack = { config: ClassConfig | FieldConfig, type: Class, name: string; }

export type VisitState = { path: VisitStack[] };

export type SortData = { table: string, field: string, alias: string, asc: boolean };

interface VisitNode<R> {
  path: VisitStack[];
  fields: FieldConfig[];
  index?: number;
  descend: () => R;
}

interface TableResolver {
  resolveTable(cls: Class, prefix?: string): string;
}

interface Select {
  type: Class;
  field: string;
}

interface OrderBy {
  type: Class;
  field: string;
  asc: boolean;
}

interface Alias {
  alias: string;
  parent?: Class;
  table: string;
}

export interface VisitInstanceNode<R> extends VisitNode<R> {
  value: any;
}

export interface VisitHandler<R, U extends VisitNode<R> = VisitNode<R>> {
  onRoot(config: U & { config: ClassConfig }): R;
  onSub(config: U & { config: FieldConfig }): R;
  onSimple(config: U & { config: FieldConfig }): R;
}

export class SQLUtil {
  private static aliasCache = new Map<Class, Map<Class, Alias>>();
  static readonly ROOT_ALIAS = '_ROOT';

  static schemaFieldsCache = new Map<Class, {
    local: FieldConfig[],
    localMap: Record<string, FieldConfig>,
    foreign: FieldConfig[],
    foreignMap: Record<string, FieldConfig>
  }>();


  static getAliasCache(cls: Class, resolve: (path: VisitStack[]) => string) {
    if (this.aliasCache.has(cls)) {
      return this.aliasCache.get(cls)!;
    }

    const clauses = new Map<Class, Alias>();
    let idx = 0;

    this.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: ({ descend, config, path }) => {
        const table = resolve(path);
        clauses.set(config.class, {
          alias: this.ROOT_ALIAS,
          table
        });
        return descend();
      },
      onSub: ({ descend, config, path }) => {
        const table = resolve(path);
        clauses.set(config.type, {
          alias: `${config.name.charAt(0)}${idx++}`,
          table,
          parent: config.owner
        });
        return descend();
      },
      onSimple: ({ config, path }) => {
        const table = resolve(path);
        clauses.set(config.type, {
          alias: `${config.name.charAt(0)}${idx++}`,
          table,
          parent: config.owner
        });
      }
    });

    this.aliasCache.set(cls, clauses);

    return clauses;
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

  static buildSort<T>(dct: Dialect, cls: Class<T>, sort: SortClause<T>[], aliases: Record<string, { alias: string }>): SortData[] {
    return sort.map((x: any) => {
      let value = false;
      let table = dct.resolveTable(cls);
      let field: string;
      while (true) {
        let key = Object.keys(x)[0] as string;
        if (Util.isPrimitive(x[key])) {
          value = !!x[key];
          field = key;
          break;
        } else {
          table = `${table}_${key}`
          x = x[key];
        }
      }

      return { table, field, alias: aliases![table].alias, asc: value };
    });
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

  static visitSchemaSync(config: ClassConfig | FieldConfig, handler: VisitHandler<void>, state: VisitState = { path: [] }) {
    const type = 'class' in config ? config.class : config.type;
    const { local: fields, foreign } = this.getFieldsByLocation(type);

    const descend = () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          this.visitSchemaSync(field, handler, state);
        } else {
          handler.onSimple({
            config: field, path: [...state.path, {
              config: field,
              name: field.name,
              type: field.type,
            }], descend: null as any, fields: []
          });
        }
      }
    };

    return handler['class' in config ? 'onRoot' : 'onSub']({
      config: config as any, fields, descend, path: [...state.path, {
        config,
        name: 'class' in config ? config.class.name : config.name,
        type: 'class' in config ? config.class : config.type
      }]
    });
  }

  static async visitSchema(config: ClassConfig | FieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [] }) {
    const type = 'class' in config ? config.class : config.type;
    const { local: fields, foreign } = this.getFieldsByLocation(type);

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          await this.visitSchemaSync(field, handler, state);
        } else {
          await handler.onSimple({
            config: field, path: [...state.path, {
              config: field,
              name: field.name,
              type: field.type,
            }], descend: null as any, fields: []
          });
        }
      }
    };

    return handler['class' in config ? 'onRoot' : 'onSub']({
      config: config as any, fields, descend, path: [...state.path, {
        config,
        name: 'class' in config ? config.class.name : config.name,
        type: 'class' in config ? config.class : config.type
      }]
    });
  }

  static async visitSchemaInstance<T extends ModelCore>(cls: Class<T>, instance: T, handler: VisitHandler<Promise<any> | any, VisitInstanceNode<Promise<any>>>) {
    const pathObj: any[] = [instance];
    await this.visitSchema(SchemaRegistry.get(cls), {
      onRoot: async (config) => {
        await handler.onRoot({ ...config, value: instance });
        return config.descend();
      },
      onSub: async (config) => {
        const { config: field } = config;
        const topObj = pathObj[pathObj.length - 1];
        const top = config.path[config.path.length - 1];
        const ogName = top.name;

        if (field.name in topObj) {
          const value = topObj[field.name];
          const isArray = Array.isArray(value);
          const vals = isArray ? value : [value];

          let i = 0;
          for (const val of vals) {
            try {
              pathObj.push(val);
              top.name = `${ogName}[${i++}]`;
              await handler.onSub({ ...config, value: val });
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
        const topObj = pathObj[pathObj.length - 1];
        const value = topObj[field.name];
        return handler.onSimple({ ...config, value });
      }
    });
  }

  static select<T>(cls: Class<T>, select: SelectClause<T>): Select[] {
    if (!select || Object.keys(select).length === 0) {
      return [{ type: cls, field: '*' }];
    }

    const { localMap } = this.getFieldsByLocation(cls);

    let toGet = new Set<string>();

    for (const [k, v] of Object.entries(select)) {
      if (!Util.isPlainObject((select as any)[k]) && localMap[k]) {
        if (!v) {
          if (toGet.size === 0) {
            toGet = new Set(SchemaRegistry.get(cls).views[ALL_VIEW].fields);
          }
          toGet.delete(k);
        } else {
          toGet.add(k);
        }
      }
    }
    return [...toGet].map((el) => ({ type: cls, field: el }));
  }

  static orderBy<T>(cls: Class<T>, sort: SortClause<T>[]): OrderBy[] {
    return sort.map((cl: any) => {
      let schema: ClassConfig = SchemaRegistry.get(cls);
      while (true) {
        let key = Object.keys(cl)[0] as string;
        if (Util.isPrimitive(cl[key])) {
          return { field: key, type: schema.class, asc: !!!!cl[key] };

        } else {
          schema = SchemaRegistry.get(schema.views[ALL_VIEW].schema[key].type);
          cl = cl[key];
        }
      }
    });
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

  static buildTable(list: VisitStack[]) {
    return list.map(el => el.name).join('_');
  }

  static async fetchDependents<T>(
    dct: Dialect,
    cls: Class<T>, items: T[],
    select?: SelectClause<T>
  ): Promise<T[]> {
    const stack: Record<string, any>[] = [];
    const selectStack: (SelectClause<T> | undefined)[] = [];

    const buildSet = (children: any[], field?: any) => this.collectDependents(dct, stack[stack.length - 1], children, field);

    await this.visitSchema(SchemaRegistry.get(cls), {
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
          const children = await dct.selectRowsByIds(
            this.buildTable(path),
            dct.parentPathField.name,
            ids,
            sel
          );

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
          const matching = await dct.selectRowsByIds(
            this.buildTable(path),
            dct.parentPathField.name,
            ids,
            [],
            [{ field: dct.idxField.name, asc: true }]
          );
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
      this.visitSchemaInstance(cls, el, {
        onRoot: ({ fields, path, value }) => {
          const table = this.buildTable(path);
          track(table, fields, path.length, [dct.pathField.name]);
          ins[table].records.push([dct.hash(path.join('.')), ...fields.map(f => dct.resolveValue(f, value[f.name]))]);
        },
        onSub: ({ fields, path, value }) => {

          const table = this.buildTable(path);
          track(table, fields, path.length, [dct.parentPathField.name, dct.pathField.name]);

          const parentPath = dct.hash(path.slice(0, path.length - 1).join('.'));
          const currentPath = dct.hash(`${path.join('.')}`);

          ins[table].records.push([
            parentPath, currentPath, ...fields.map(f => dct.resolveValue(f, value[f.name]))
          ]);
        },
        onSimple: async ({ config: field, path, value }) => {
          const table = this.buildTable(path);
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