import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelRegistry, ModelCore, SelectClause, SortClause } from '@travetto/model';
import { SchemaRegistry, ClassConfig, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { DialectState, InsertWrapper } from './types';

export type VisitStack = {
  array?: boolean;
  type: Class;
  name: string;
  index?: number;
};

export type VisitState = { path: VisitStack[] };

const TABLE_SYM = Symbol('TABLE');
const PATH_SYM = Symbol('PATH');

interface VisitNode<R> {
  path: VisitStack[];
  fields: FieldConfig[];
  descend: () => R;
}

interface OrderBy {
  stack: VisitStack[];
  asc: boolean;
}

interface Alias {
  alias: string;
  path: VisitStack[];
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
  private static aliasCache = new Map<Class, Map<string, Alias>>();
  static readonly ROOT_ALIAS = '_ROOT';

  static schemaFieldsCache = new Map<Class, {
    local: FieldConfig[],
    localMap: Record<string, FieldConfig>,
    foreign: FieldConfig[],
    foreignMap: Record<string, FieldConfig>
  }>();

  static classToStack(type: Class): VisitStack[] {
    return [{ type, name: type.name }];
  }

  static getAliasCache(stack: VisitStack[], resolve: (path: VisitStack[]) => string) {
    const cls = stack[0].type;

    if (this.aliasCache.has(cls)) {
      return this.aliasCache.get(cls)!;
    }

    const clauses = new Map<string, Alias>();
    let idx = 0;

    this.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: ({ descend, path }) => {
        const table = resolve(path);
        clauses.set(table, { alias: this.ROOT_ALIAS, path });
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

  static cleanResults<T>(dct: DialectState, o: T): T {
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

  static getFieldsByLocation(stack: VisitStack[]) {
    const top = stack[stack.length - 1];
    const cls = SchemaRegistry.get(top.type);

    if (cls && this.schemaFieldsCache.has(cls.class)) {
      return this.schemaFieldsCache.get(cls.class)!;
    }

    if (!cls) { // If a simple type, it is it's own field
      const field = top as FieldConfig;
      return {
        local: [field], localMap: { [field.name]: field },
        foreign: [], foreignMap: {}
      };
    }

    const model = ModelRegistry.get(cls.class)!;
    const conf = cls.views[ALL_VIEW];
    const fields = conf.fields.map(x => conf.schema[x]);

    // Polymorphic
    if (model && (model.baseType || model.subType)) {
      const fieldMap = new Set(fields.map(f => f.name));
      for (const type of ModelRegistry.getClassesByBaseType(ModelRegistry.getBaseModel(cls.class))) {
        const typeConf = SchemaRegistry.get(type).views[ALL_VIEW];
        for (const f of typeConf.fields) {
          if (!fieldMap.has(f)) {
            fieldMap.add(f);
            fields.push({ ...typeConf.schema[f], required: { active: false } });
          }
        }
      }
    }

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
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, config];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          this.visitSchemaSync(field, handler, { path });
        } else {
          handler.onSimple({
            config: field, descend: null as any, fields: [], path: [
              ...path,
              field
            ]
          });
        }
      }
    };

    if ('class' in config) {
      return handler.onRoot({ config, fields, descend, path });
    } else {
      return handler.onSub({ config, fields, descend, path });
    }
  }

  static async visitSchema(config: ClassConfig | FieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [] }) {
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, { ...config }];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          await this.visitSchema(field, handler, { path });
        } else {
          await handler.onSimple({
            config: field, descend: null as any, fields: [], path: [
              ...path,
              { ...field }
            ]
          });
        }
      }
    };

    if ('class' in config) {
      return handler.onRoot({ config, fields, descend, path });
    } else {
      return handler.onSub({ config, fields, descend, path });
    }
  }

  static visitSchemaInstance<T extends ModelCore>(cls: Class<T>, instance: T, handler: VisitHandler<any, VisitInstanceNode<any>>) {
    const pathObj: any[] = [instance];
    this.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: (config) => {
        const { path } = config;
        path[0].name = instance['id'] as any;
        handler.onRoot({ ...config, value: instance });
        return config.descend();
      },
      onSub: (config) => {
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
              config.path[config.path.length - 1] = { ...top, index: i++ };
              handler.onSub({ ...config, value: val });
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

  static select<T>(cls: Class<T>, select?: SelectClause<T>): FieldConfig[] {
    if (!select || Object.keys(select).length === 0) {
      return [{ type: cls, name: '*' } as FieldConfig];
    }

    const { localMap } = this.getFieldsByLocation(this.classToStack(cls));

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
    return [...toGet].map(el => localMap[el]);
  }

  static orderBy<T>(cls: Class<T>, sort: SortClause<T>[]): OrderBy[] {
    return sort.map((cl: any) => {
      let schema: ClassConfig = SchemaRegistry.get(cls);
      const stack = this.classToStack(cls);
      while (true) {
        const key = Object.keys(cl)[0] as string;
        const field = schema.views[ALL_VIEW].schema[key];
        if (Util.isPrimitive(cl[key])) {
          stack.push(field);
          return { stack, asc: !!!!cl[key] };
        } else {
          stack.push(field);
          schema = SchemaRegistry.get(field.type);
          cl = cl[key];
        }
      }
    });
  }

  static collectDependents<T extends any>(dct: DialectState, parent: any, v: T[], field?: FieldConfig) {
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
      mapping[(el as any)[dct.pathField.name]] = el;
    }
    return mapping;
  }

  static buildTable(list: VisitStack[]) {
    const top = list[list.length - 1] as any;
    if (!top[TABLE_SYM]) {
      top[TABLE_SYM] = list.map((el, i) => i === 0 ? ModelRegistry.getBaseCollection(el.type) : el.name).join('_');
    }
    return top[TABLE_SYM];
  }

  static buildPath(list: VisitStack[]) {
    const top = list[list.length - 1] as any;
    if (!top[PATH_SYM]) {
      top[PATH_SYM] = list.map((el, i) => `${el.name}${el.index ? `[${el.index}]` : ''}`).join('.');
    }
    return top[PATH_SYM];
  }

  static async extractInserts<T>(cls: Class<T>, els: T[]): Promise<InsertWrapper[]> {
    const ins = {} as Record<string, InsertWrapper>;

    const track = (stack: VisitStack[], value: any) => {
      const key = this.buildTable(stack);
      (ins[key] = ins[key] || { stack, records: [] }).records.push({ stack, value });
    };

    const all = els.map(el =>
      this.visitSchemaInstance(cls, el, {
        onRoot: ({ path, value }) => track(path, value),
        onSub: ({ path, value }) => track(path, value),
        onSimple: ({ path, value }) => track(path, value)
      }));

    await Promise.all(all);

    const ret = [...Object.values(ins)].sort((a, b) => a.stack.length - b.stack.length);

    return ret;
  }
}