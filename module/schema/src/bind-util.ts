import { castTo, Class, classConstruct, asFull, TypedObject, castKey } from '@travetto/runtime';

import { DataUtil } from './data.ts';
import { SchemaInputConfig, SchemaParameterConfig, SchemaFieldMap } from './service/types.ts';
import { SchemaRegistryIndex } from './service/registry-index.ts';

type BindConfig = {
  view?: string;
  filterInput?: (input: SchemaInputConfig) => boolean;
  filterValue?: (value: unknown, input: SchemaInputConfig) => boolean;
};

function isInstance<T>(o: unknown): o is T {
  return !!o && !DataUtil.isPrimitive(o);
}

/**
 * Utilities for binding objects to schemas
 */
export class BindUtil {

  /**
   * Coerce a value to match the field config type
   * @param conf The field config to coerce to
   * @param value The provided value
   */
  static #coerceType<T>(conf: SchemaInputConfig, value: unknown): T | null | undefined {
    if (conf.type?.bindSchema) {
      value = conf.type.bindSchema(value);
    } else {
      value = DataUtil.coerceType(value, conf.type, false);

      if (conf.type === Number && conf.precision && typeof value === 'number') {
        if (conf.precision[1]) { // Supports decimal
          value = +value.toFixed(conf.precision[1]);
        } else { // 0 digits
          value = Math.trunc(value);
        }
      }
    }
    return castTo(value);
  }

  /**
   * Convert dotted paths into a full object
   *
   * This will convert `{ 'a.b[3].c[age]': 5 }` => `{ a : { b : [,,,{ c: { age: 5 }}]}}`
   *
   * @param obj The object to convert
   */
  static expandPaths(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const objK = obj[k];
      const value = DataUtil.isPlainObject(objK) ? this.expandPaths(objK) : objK;
      const parts = k.split('.');
      const last = parts.pop()!;
      let sub = out;
      while (parts.length > 0) {
        const part = parts.shift()!;
        const partArr = part.indexOf('[') > 0;
        const name = part.split(/[^A-Za-z_0-9]/)[0];
        const idx = partArr ? part.split(/[\[\]]/)[1] : '';
        const key = partArr ? (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined)) : undefined;

        if (!(name in sub)) {
          sub[name] = typeof key === 'number' ? [] : {};
        }
        sub = castTo(sub[name]);

        if (idx && key !== undefined) {
          sub[key] ??= {};
          sub = castTo(sub[key]);
        }
      }

      const arr = last.indexOf('[') > 0;

      if (!arr) {
        if (sub[last] && DataUtil.isPlainObject(value)) {
          sub[last] = DataUtil.deepAssign(sub[last], value, 'coerce');
        } else {
          sub[last] = value;
        }
      } else {
        const name = last.split(/[^A-Za-z_0-9]/)[0];
        const idx = last.split(/[\[\]]/)[1];

        let key = (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined));
        sub[name] ??= (typeof key === 'string') ? {} : [];

        const arrSub: Record<string, unknown> & { length: number } = castTo(sub[name]);
        if (key === undefined) {
          key = arrSub.length;
        }
        if (arrSub[key] && DataUtil.isPlainObject(value) && DataUtil.isPlainObject(arrSub[key])) {
          arrSub[key] = DataUtil.deepAssign(arrSub[key], value, 'coerce');
        } else {
          arrSub[key] = value;
        }
      }
    }
    return out;
  }

  /**
   * Convert full object with nesting, into flat set of keys
   * @param data The object to flatten the paths for
   * @param prefix The starting prefix
   */
  static flattenPaths<V extends string = string>(data: Record<string, unknown>, prefix: string = ''): Record<string, V> {
    const out: Record<string, V> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = `${prefix}${key}`;
      if (DataUtil.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, `${pre}.`)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (DataUtil.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}].`));
          } else {
            out[`${pre}[${i}]`] = v ?? '';
          }
        }
      } else {
        out[pre] = castTo(value ?? '');
      }
    }
    return out;
  }

  /**
   * Bind data to the schema for a class, with an optional view
   * @param cls The schema class to bind against
   * @param data The provided data to bind
   * @param config The bind configuration
   */
  static bindSchema<T>(cls: Class<T>, data?: undefined, config?: BindConfig): undefined;
  static bindSchema<T>(cls: Class<T>, data?: null, config?: BindConfig): null;
  static bindSchema<T>(cls: Class<T>, data?: object | T, config?: BindConfig): T;
  static bindSchema<T>(cls: Class<T>, data?: object | T, config?: BindConfig): T | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    if (data instanceof cls) {
      return castTo(data);
    } else {
      const resolvedCls = SchemaRegistryIndex.resolveInstanceType<T>(cls, asFull<T>(data));
      const instance = classConstruct<T & { type?: string }>(resolvedCls);

      for (const k of TypedObject.keys(instance)) { // Do not retain undefined fields
        if (instance[k] === undefined) {
          delete instance[k];
        }
      }

      const out = this.bindSchemaToObject(resolvedCls, instance, data, config);
      SchemaRegistryIndex.get(resolvedCls).ensureInstanceTypeField(out);
      return out;
    }
  }

  /**
   * Bind the schema to the object
   * @param cls The schema class
   * @param obj The target object (instance of cls)
   * @param data The data to bind
   * @param config The bind configuration
   */
  static bindSchemaToObject<T>(cls: Class<T>, obj: T, data?: object, config: BindConfig = {}): T {
    const view = config.view; // Does not convey
    delete config.view;

    if (!!data && isInstance<T>(data)) {
      const adapter = SchemaRegistryIndex.get(cls);
      const conf = adapter.get();

      // If no configuration
      if (!conf) {
        for (const k of TypedObject.keys(data)) {
          obj[k] = data[k];
        }
      } else {
        let schema: SchemaFieldMap = conf.fields;
        if (view) {
          schema = adapter.getFields(view);
          if (!schema) {
            throw new Error(`View not found: ${view.toString()}`);
          }
        }

        for (const [schemaFieldName, field] of Object.entries(schema)) {
          let inboundField: string | undefined = undefined;
          if (field.access === 'readonly' || config.filterInput?.(field) === false) {
            continue; // Skip trying to write readonly fields
          }
          if (schemaFieldName in data) {
            inboundField = schemaFieldName;
          } else if (field.aliases) {
            for (const aliasedField of (field.aliases ?? [])) {
              if (aliasedField in data) {
                inboundField = aliasedField;
                break;
              }
            }
          }

          if (!inboundField) {
            continue;
          }

          let v: unknown = data[castKey<T>(inboundField)];

          // Filtering values
          if (config.filterValue && !config.filterValue(v, field)) {
            continue;
          }

          if (v !== undefined && v !== null) {
            // Ensure its an array
            if (!Array.isArray(v) && field.array) {
              if (typeof v === 'string' && v.includes(',')) {
                v = v.split(/,/).map(x => x.trim());
              } else {
                v = [v];
              }
            }

            if (SchemaRegistryIndex.has(field.type)) {
              if (field.array && Array.isArray(v)) {
                v = v.map(el => this.bindSchema(field.type, el, config));
              } else {
                v = this.bindSchema(field.type, v, config);
              }
            } else if (field.array && Array.isArray(v)) {
              v = v.map(el => this.#coerceType(field, el));
            } else {
              v = this.#coerceType(field, v);
            }
          }

          obj[castKey<T>(schemaFieldName)] = castTo(v);

          if (field.accessor) {
            Object.defineProperty(obj, schemaFieldName, {
              ...adapter.getAccessorDescriptor(schemaFieldName),
              enumerable: true
            });
          }
        }
      }
    }

    return obj;
  }

  /**
   * Coerce field to type
   * @param config
   * @param value
   * @param applyDefaults
   * @returns
   */
  static coerceInput(config: SchemaInputConfig, value: unknown, applyDefaults = false): unknown {
    if ((value === undefined || value === null) && applyDefaults) {
      value = Array.isArray(config.default) ? config.default.slice(0) : config.default;
    }
    if (config.required?.active === false && (value === undefined || value === null)) {
      return value;
    }
    const complex = SchemaRegistryIndex.has(config.type);
    const bindCfg: BindConfig | undefined = (complex && 'view' in config && typeof config.view === 'string') ? { view: config.view } : undefined;
    if (config.array) {
      const valArr = !Array.isArray(value) ? [value] : value;
      if (complex) {
        value = valArr.map(x => this.bindSchema(config.type, x, bindCfg));
      } else {
        value = valArr.map(x => DataUtil.coerceType(x, config.type, false));
      }
    } else {
      if (complex) {
        value = this.bindSchema(config.type, value, bindCfg);
      } else {
        value = DataUtil.coerceType(value, config.type, false);
      }
    }
    return value;
  }

  /**
   * Coerce multiple params at once
   * @param fields
   * @param params
   * @returns
   */
  static coerceParameters(fields: SchemaParameterConfig[], params: unknown[], applyDefaults = true): unknown[] {
    params = [...params];
    // Coerce types
    for (const el of fields) {
      params[el.index!] = this.coerceInput(el, params[el.index!], applyDefaults);
    }
    return params;
  }

  /**
   * Coerce method parameters when possible
   * @param cls
   * @param method
   * @param params
   * @returns
   */
  static coerceMethodParams<T>(cls: Class<T>, method: string | symbol, params: unknown[], applyDefaults = true): unknown[] {
    const paramConfigs = SchemaRegistryIndex.get(cls).getMethod(method).parameters;
    return this.coerceParameters(paramConfigs, params, applyDefaults);
  }
}