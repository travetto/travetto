import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelRegistry, ModelCore, SelectClause, SortClause } from '@travetto/model';
import { SchemaRegistry, ClassConfig, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { DialectState, InsertWrapper, VisitHandler, VisitState, VisitInstanceNode, OrderBy } from './types';

const TABLE_SYM = Symbol.for('@trv:model-sql/table');

export type VisitStack = {
  [TABLE_SYM]?: string;
  array?: boolean;
  type: Class;
  name: string;
  index?: number;
};

/**
 * Utilities for dealing with SQL operations
 */
export class SQLUtil {
  static readonly ROOT_ALIAS = '_ROOT';

  static schemaFieldsCache = new Map<Class, {
    local: FieldConfig[];
    localMap: Record<string, FieldConfig>;
    foreign: FieldConfig[];
    foreignMap: Record<string, FieldConfig>;
  }>();

  /**
   * Creates a new visitation stack with the class as the root
   */
  static classToStack(type: Class): VisitStack[] {
    return [{ type, name: type.name }];
  }

  /**
   * Clean results from db, by dropping internal fields
   */
  static cleanResults<T>(dct: DialectState, o: T[]): T[];
  static cleanResults<T>(dct: DialectState, o: T): T;
  static cleanResults<T>(dct: DialectState, o: T | T[]): T | T[] {
    if (Array.isArray(o)) {
      return o.filter(x => x !== null && x !== undefined).map(x => this.cleanResults(dct, x));
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

  /**
   * Get all available fields at current stack path
   */
  static getFieldsByLocation(stack: VisitStack[]) {
    const top = stack[stack.length - 1];
    const cls = SchemaRegistry.get(top.type);

    if (cls && this.schemaFieldsCache.has(cls.class)) {
      return this.schemaFieldsCache.get(cls.class)!;
    }

    if (!cls) { // If a simple type, it is it's own field
      const field = { ...top } as FieldConfig;
      return {
        local: [field], localMap: { [field.name]: field },
        foreign: [], foreignMap: {}
      };
    }

    const model = ModelRegistry.get(cls.class)!;
    const conf = cls.views[ALL_VIEW];
    const fields = conf.fields.map(x => ({ ...conf.schema[x] }));

    // Polymorphic
    if (model && (model.baseType ?? model.subType)) {
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

  /**
   * Process a schema structure, synchronously
   */
  static visitSchemaSync(config: ClassConfig | FieldConfig, handler: VisitHandler<void>, state: VisitState = { path: [] }) {
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, config];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          this.visitSchemaSync(field, handler, { path });
        } else {
          handler.onSimple({
            config: field,
            fields: [],
            path: [...path, field]
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

  /**
   * Visit a Schema structure
   */
  static async visitSchema(config: ClassConfig | FieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [] }) {
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, config];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = async () => {
      for (const field of foreign) {
        if (SchemaRegistry.has(field.type)) {
          await this.visitSchema(field, handler, { path });
        } else {
          await handler.onSimple({
            config: field,
            fields: [],
            path: [...path, field]
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

  /**
   * Process a schema instance by visiting it synchronously.  This is synchronous to prevent concurrent calls from breaking
   */
  static visitSchemaInstance<T extends ModelCore>(cls: Class<T>, instance: T, handler: VisitHandler<any, VisitInstanceNode<any>>) {
    const pathObj: any[] = [instance];
    this.visitSchemaSync(SchemaRegistry.get(cls), {
      onRoot: (config) => {
        const { path } = config;
        path[0].name = instance['id']!;
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

  /**
   * Get list of selected fields
   */
  static select<T>(cls: Class<T>, select?: SelectClause<T>): FieldConfig[] {
    if (!select || Object.keys(select).length === 0) {
      return [{ type: cls, name: '*' } as FieldConfig];
    }

    const { localMap } = this.getFieldsByLocation(this.classToStack(cls));

    let toGet = new Set<string>();

    for (const [k, v] of Object.entries(select)) {
      if (!Util.isPlainObject(select[k as keyof typeof select]) && localMap[k]) {
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

  /**
   * Get list of Order By clauses
   */
  static orderBy<T>(cls: Class<T>, sort: SortClause<T>[]): OrderBy[] {
    return sort.map((cl: any) => {
      let schema: ClassConfig = SchemaRegistry.get(cls);
      const stack = this.classToStack(cls);
      let found: OrderBy | undefined;
      while (!found) {
        const key = Object.keys(cl)[0] as string;
        const val = cl[key];
        const field = { ...schema.views[ALL_VIEW].schema[key] };
        if (Util.isPrimitive(val)) {
          stack.push(field);
          found = { stack, asc: val === 1 || val === true };
        } else {
          stack.push(field);
          schema = SchemaRegistry.get(field.type);
          cl = val;
        }
      }
      return found;
    });
  }

  /**
   * Find all dependent fields via child tables
   */
  static collectDependents<T>(dct: DialectState, parent: any, v: T[], field?: FieldConfig) {
    if (field) {
      const isSimple = SchemaRegistry.has(field.type);
      for (const el of v) {
        const root = parent[el[dct.parentPathField.name as keyof T]];
        if (field.array) {
          if (!root[field.name]) {
            root[field.name] = [isSimple ? el : el[field.name as keyof T]];
          } else {
            root[field.name].push(isSimple ? el : el[field.name as keyof T]);
          }
        } else {
          root[field.name] = isSimple ? el : el[field.name as keyof T];
        }
      }
    }

    const mapping: Record<string, T> = {};
    for (const el of v) {
      const key = el[dct.pathField.name as keyof T];
      // @ts-ignore
      mapping[key] = el;
    }
    return mapping;
  }

  /**
   * Build table name via stack path
   */
  static buildTable(list: VisitStack[]) {
    const top = list[list.length - 1];
    if (!top[TABLE_SYM]) {
      top[TABLE_SYM] = list.map((el, i) => i === 0 ? ModelRegistry.getBaseCollection(el.type) : el.name).join('_');
    }
    return top[TABLE_SYM]!;
  }

  /**
   * Build property path for a table/field given the current stack
   */
  static buildPath(list: VisitStack[]) {
    return list.map((el, i) => `${el.name}${el.index ? `[${el.index}]` : ''}`).join('.');
  }

  /**
   * Get insert statements for a given class, and its child tables
   */
  static async getInserts<T>(cls: Class<T>, els: T[]): Promise<InsertWrapper[]> {
    const ins = {} as Record<string, InsertWrapper>;

    const track = (stack: VisitStack[], value: any) => {
      const key = this.buildTable(stack);
      (ins[key] = ins[key] ?? { stack, records: [] }).records.push({ stack, value });
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