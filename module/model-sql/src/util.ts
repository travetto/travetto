import { castKey, castTo, Class, TypedObject } from '@travetto/runtime';
import { SelectClause, SortClause } from '@travetto/model-query';
import { ModelRegistryIndex, ModelType, OptionalId } from '@travetto/model';
import { SchemaClassConfig, SchemaFieldConfig, DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import { DialectState, InsertWrapper, VisitHandler, VisitState, VisitInstanceNode, OrderBy } from './internal/types.ts';
import { TableSymbol, VisitStack } from './types.ts';

type FieldCacheEntry = {
  local: SchemaFieldConfig[];
  localMap: Record<string | symbol, SchemaFieldConfig>;
  foreign: SchemaFieldConfig[];
  foreignMap: Record<string | symbol, SchemaFieldConfig>;
};

/**
 * Utilities for dealing with SQL operations
 */
export class SQLModelUtil {

  static #schemaFieldsCache = new Map<Class, FieldCacheEntry>();

  /**
   * Creates a new visitation stack with the class as the root
   */
  static classToStack(type: Class): VisitStack[] {
    return [{ type, name: type.name }];
  }

  /**
   * Clean results from db, by dropping internal fields
   */
  static cleanResults<T, U = T>(state: DialectState, item: T[]): U[];
  static cleanResults<T, U = T>(state: DialectState, item: T): U;
  static cleanResults<T, U = T>(state: DialectState, item: T | T[]): U | U[] {
    if (Array.isArray(item)) {
      return item.filter(x => x !== null && x !== undefined).map(x => this.cleanResults(state, x));
    } else if (!DataUtil.isSimpleValue(item)) {
      for (const key of TypedObject.keys(item)) {
        if (item[key] === null || item[key] === undefined || key === state.parentPathField.name || key === state.pathField.name || key === state.idxField.name) {
          delete item[key];
        } else {
          item[key] = this.cleanResults(state, item[key]);
        }
      }
      return castTo({ ...item });
    } else {
      return castTo(item);
    }
  }

  /**
   * Get all available fields at current stack path
   */
  static getFieldsByLocation(stack: VisitStack[]): FieldCacheEntry {
    const top = stack.at(-1)!;
    const config = SchemaRegistryIndex.getOptional(top.type)?.get();

    if (config && this.#schemaFieldsCache.has(config.class)) {
      return this.#schemaFieldsCache.get(config.class)!;
    }

    if (!config) { // If a simple type, it is it's own field
      const field: SchemaFieldConfig = castTo({ ...top });
      return {
        local: [field], localMap: { [field.name]: field },
        foreign: [], foreignMap: {}
      };
    }

    const hasModel = ModelRegistryIndex.has(config.class)!;
    const fields = Object.values(config.fields).map(field => ({ ...field }));

    // Polymorphic
    if (hasModel && config.discriminatedBase) {
      const fieldMap = new Set(fields.map(field => field.name));
      for (const type of SchemaRegistryIndex.getDiscriminatedClasses(config.class)) {
        const typeConfig = SchemaRegistryIndex.getConfig(type);
        for (const [fieldName, field] of Object.entries<SchemaFieldConfig>(typeConfig.fields)) {
          if (!fieldMap.has(fieldName)) {
            fieldMap.add(fieldName);
            fields.push({ ...field, required: { active: false } });
          }
        }
      }
    }

    const ret: FieldCacheEntry = {
      localMap: {},
      foreignMap: {},
      local: fields.filter(x => !SchemaRegistryIndex.has(x.type) && !x.array),
      foreign: fields.filter(x => SchemaRegistryIndex.has(x.type) || x.array)
    };

    ret.local.reduce((acc, field) => (acc[field.name] = field) && acc, ret.localMap);
    ret.foreign.reduce((acc, field) => (acc[field.name] = field) && acc, ret.foreignMap);

    this.#schemaFieldsCache.set(config.class, ret);

    return ret;
  }

  /**
   * Process a schema structure, synchronously
   */
  static visitSchemaSync(config: SchemaClassConfig | SchemaFieldConfig, handler: VisitHandler<void>, state: VisitState = { path: [] }): void {
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, config];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = (): void => {
      for (const field of foreign) {
        if (SchemaRegistryIndex.has(field.type)) {
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
  static async visitSchema(config: SchemaClassConfig | SchemaFieldConfig, handler: VisitHandler<Promise<void>>, state: VisitState = { path: [] }): Promise<void> {
    const path = 'class' in config ? this.classToStack(config.class) : [...state.path, config];
    const { local: fields, foreign } = this.getFieldsByLocation(path);

    const descend = async (): Promise<void> => {
      for (const field of foreign) {
        if (SchemaRegistryIndex.has(field.type)) {
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
  static visitSchemaInstance<T extends ModelType>(cls: Class<T>, instance: T | OptionalId<T>, handler: VisitHandler<unknown, VisitInstanceNode<unknown>>): void {
    const pathObj: unknown[] = [instance];
    this.visitSchemaSync(SchemaRegistryIndex.getConfig(cls), {
      onRoot: (config) => {
        const { path } = config;
        path[0].name = instance.id!;
        handler.onRoot({ ...config, value: instance });
        return config.descend();
      },
      onSub: (config) => {
        const { config: field } = config;
        const topObj: Record<string | symbol, unknown> = castTo(pathObj.at(-1));
        const top = config.path.at(-1)!;

        if (field.name in topObj) {
          const valuesInput = topObj[field.name];
          const values = Array.isArray(valuesInput) ? valuesInput : [valuesInput];

          let i = 0;
          for (const value of values) {
            try {
              pathObj.push(value);
              config.path[config.path.length - 1] = { ...top, index: i++ };
              handler.onSub({ ...config, value });
              if (!field.array) {
                config.descend();
              }
            } finally {
              pathObj.pop();
            }
            i += 1;
          }
          if (field.array) {
            config.descend();
          }
        }
      },
      onSimple: (config) => {
        const { config: field } = config;
        const topObj: Record<string | symbol, unknown> = castTo(pathObj.at(-1));
        const value = topObj[field.name];
        return handler.onSimple({ ...config, value });
      }
    });
  }

  /**
   * Get list of selected fields
   */
  static select<T>(cls: Class<T>, select?: SelectClause<T>): SchemaFieldConfig[] {
    if (!select || Object.keys(select).length === 0) {
      return [{ type: cls, name: '*', owner: cls, array: false }];
    }

    const { localMap } = this.getFieldsByLocation(this.classToStack(cls));

    let toGet = new Set<string>();

    for (const [key, value] of TypedObject.entries(select)) {
      if (typeof key === 'string' && !DataUtil.isPlainObject(select[key]) && localMap[key]) {
        if (!value) {
          if (toGet.size === 0) {
            toGet = new Set(Object.keys(SchemaRegistryIndex.getConfig(cls).fields));
          }
          toGet.delete(key);
        } else {
          toGet.add(key);
        }
      }
    }
    return [...toGet].map(field => localMap[field]);
  }

  /**
   * Get list of Order By clauses
   */
  static orderBy<T>(cls: Class<T>, sort: SortClause<T>[]): OrderBy[] {
    return sort.map((cl: Record<string, unknown>) => {
      let schema: SchemaClassConfig = SchemaRegistryIndex.getConfig(cls);
      const stack = this.classToStack(cls);
      let found: OrderBy | undefined;
      while (!found) {
        const key = Object.keys(cl)[0];
        const value = cl[key];
        const field = { ...schema.fields[key] };
        if (DataUtil.isPrimitive(value)) {
          stack.push(field);
          found = { stack, asc: value === 1 };
        } else {
          stack.push(field);
          schema = SchemaRegistryIndex.getConfig(field.type);
          cl = castTo(value);
        }
      }
      return found;
    });
  }

  /**
   * Find all dependent fields via child tables
   */
  static collectDependents<T>(state: DialectState, parent: unknown, items: T[], field?: SchemaFieldConfig): Record<string, T> {
    if (field) {
      const isSimple = SchemaRegistryIndex.has(field.type);
      for (const item of items) {
        const parentKey: string = castTo(item[castKey<T>(state.parentPathField.name)]);
        const root = castTo<Record<string, Record<string, unknown>>>(parent)[parentKey];
        const fieldKey = castKey<(typeof root) | T>(field.name);
        if (field.array) {
          if (!root[fieldKey]) {
            root[fieldKey] = [isSimple ? item : item[fieldKey]];
          } else if (Array.isArray(root[fieldKey])) {
            root[fieldKey].push(isSimple ? item : item[fieldKey]);
          }
        } else {
          root[fieldKey] = isSimple ? item : item[fieldKey];
        }
      }
    }

    const mapping: Record<string, T> = {};
    for (const item of items) {
      const key = item[castKey<T>(state.pathField.name)];
      if (typeof key === 'string') {
        mapping[key] = item;
      }
    }
    return mapping;
  }

  /**
   * Build table name via stack path
   */
  static buildTable(list: VisitStack[]): string {
    const top = list.at(-1)!;
    if (!top[TableSymbol]) {
      top[TableSymbol] = list.map((item, i) => i === 0 ? ModelRegistryIndex.getStoreName(item.type) : item.name).join('_');
    }
    return top[TableSymbol]!;
  }

  /**
   * Build property path for a table/field given the current stack
   */
  static buildPath(list: VisitStack[]): string {
    return list.map((item) => `${item.name.toString()}${item.index ? `[${item.index}]` : ''}`).join('.');
  }

  /**
   * Get insert statements for a given class, and its child tables
   */
  static async getInserts<T extends ModelType>(cls: Class<T>, items: (T | OptionalId<T>)[]): Promise<InsertWrapper[]> {
    const ins: Record<string, InsertWrapper> = {};

    const track = (stack: VisitStack[], value: unknown): void => {
      const key = this.buildTable(stack);
      (ins[key] = ins[key] ?? { stack, records: [] }).records.push({ stack, value });
    };

    const all = items.map(item =>
      this.visitSchemaInstance(cls, item, {
        onRoot: ({ path, value }) => track(path, value),
        onSub: ({ path, value }) => track(path, value),
        onSimple: ({ path, value }) => track(path, value)
      }));

    await Promise.all(all);

    const result = [...Object.values(ins)].toSorted((a, b) => a.stack.length - b.stack.length);
    return result;
  }
}