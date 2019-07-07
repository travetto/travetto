import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelRegistry, ModelCore, SelectClause, SortClause } from '@travetto/model';
import { SchemaRegistry, ClassConfig, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { Dialect, InsertWrapper } from './types';

export type VisitStack = {
  config: ClassConfig | FieldConfig;
  type: Class;
  name: string;
  index?: number;
}

export type VisitState = { path: VisitStack[] };

interface VisitNode<R> {
  path: VisitStack[];
  fields: FieldConfig[];
  descend: () => R;
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

  static classToStack(type: Class): VisitStack[] {
    const config = SchemaRegistry.get(type);
    return [{ config, type, name: type.name }];
  }

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
    let path: VisitStack[];

    const descend = () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          this.visitSchemaSync(field, handler, { path });
        } else {
          handler.onSimple({
            config: field, descend: null as any, fields: [], path: [
              ...path,
              { config: field, name: field.name, type: field.type }
            ]
          });
        }
      }
    };

    if ('class' in config) {
      path = this.classToStack(type);
      return handler.onRoot({ config, fields, descend, path });
    } else {
      path = [
        ...state.path,
        { config, name: config.name, type: config.type }
      ];
      return handler.onSub({ config, fields, descend, path });
    }
  }

  static async visitSchema(config: ClassConfig | FieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [] }) {
    const type = 'class' in config ? config.class : config.type;
    const { local: fields, foreign } = this.getFieldsByLocation(type);

    let path: VisitStack[];

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          await this.visitSchemaSync(field, handler, { path });
        } else {
          await handler.onSimple({
            config: field, descend: null as any, fields: [], path: [
              ...path,
              { config: field, name: field.name, type: field.type }
            ]
          });
        }
      }
    };

    if ('class' in config) {
      path = this.classToStack(type);
      return handler.onRoot({ config, fields, descend: descend.bind(null, path), path });
    } else {
      path = [
        ...state.path,
        { config, name: config.name, type: config.type }
      ];
      return handler.onSub({ config, fields, descend: descend.bind(null, path), path });
    }
  }

  static async visitSchemaInstance<T extends ModelCore>(cls: Class<T>, instance: T, handler: VisitHandler<Promise<any> | any, VisitInstanceNode<Promise<any>>>) {
    const pathObj: any[] = [instance];
    await this.visitSchema(SchemaRegistry.get(cls), {
      onRoot: async (config) => {
        const { path } = config;
        path[0].name = instance['id'] as any;
        await handler.onRoot({ ...config, value: instance });
        return config.descend();
      },
      onSub: async (config) => {
        const { config: field } = config;
        const topObj = pathObj[pathObj.length - 1];
        const top = config.path[config.path.length - 1];

        if (field.name in topObj) {
          const value = topObj[field.name];
          const isArray = Array.isArray(value);
          const vals = isArray ? value : [value];

          let i = 0;
          for (const val of vals) {
            try {
              pathObj.push(val);
              top.index = i++;
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

  static select<T>(cls: Class<T>, select?: SelectClause<T>): Select[] {
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
    return list.map((el, i) => i === 0 ? ModelRegistry.getBaseCollection(el.type) : el.name).join('_');
  }

  static buildPath(list: VisitStack[]) {
    return list.map((el, i) => `${el.name}${el.index ? `[${el.index}]` : ''}`).join('.');
  }

  static async extractInserts<T>(cls: Class<T>, els: T[]): Promise<InsertWrapper[]> {
    const ins = {} as Record<string, InsertWrapper>;

    const track = (stack: VisitStack[], value: any) => {
      const key = this.buildTable(stack);
      (ins[key] = ins[key] || { stack, records: [] }).records.push([stack, value]);
    }

    const all = els.map(el =>
      this.visitSchemaInstance(cls, el, {
        onRoot: ({ path, value }) => track(path, value),
        onSub: ({ path, value }) => track(path, value),
        onSimple: ({ path, value }) => track(path, value)
      }));

    await Promise.all(all);

    const ret = [...Object.values(ins)].sort((a, b) => a.stack.length - b.stack.length);;

    return ret;
  };

}