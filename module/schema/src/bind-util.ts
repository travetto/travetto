import { castTo, type Class, classConstruct, asFull, TypedObject, castKey } from '@travetto/runtime';

import { DataUtil } from './data.ts';
import type { SchemaInputConfig, SchemaParameterConfig, SchemaFieldMap } from './service/types.ts';
import { SchemaRegistryIndex } from './service/registry-index.ts';
import { SchemaTypeUtil } from './type-config.ts';

type BindConfig = {
  view?: string;
  filterInput?: (input: SchemaInputConfig) => boolean;
  filterValue?: (value: unknown, input: SchemaInputConfig) => boolean;
};

function isInstance<T>(value: unknown): value is T {
  return !!value && !DataUtil.isPrimitive(value);
}

/**
 * Utilities for binding objects to schemas
 */
export class BindUtil {

  /**
   * Coerce a value to match the field config type
   * @param config The field config to coerce to
   * @param value The provided value
   */
  static #coerceType<T>(config: SchemaInputConfig, value: unknown): T | null | undefined {
    const typeConfig = SchemaTypeUtil.getSchemaTypeConfig(config.type);
    if (typeConfig?.bind) {
      value = typeConfig.bind(value);
    } else {
      value = DataUtil.coerceType(value, config.type, false);

      if (config.type === Number && config.precision && typeof value === 'number') {
        if (config.precision[1]) { // Supports decimal
          value = +value.toFixed(config.precision[1]);
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
   * @param input The object to convert
   */
  static expandPaths(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const property of Object.keys(input)) {
      const valueInput = input[property];
      const value = DataUtil.isPlainObject(valueInput) ? this.expandPaths(valueInput) : valueInput;
      const parts = property.split('.');
      const last = parts.pop()!;
      let sub = out;
      while (parts.length > 0) {
        const part = parts.shift()!;
        const partArrayIndex = part.indexOf('[') > 0;
        const name = part.split(/[^A-Za-z_0-9]/)[0];
        const idx = partArrayIndex ? part.split(/[\[\]]/)[1] : '';
        const key = partArrayIndex ? (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined)) : undefined;

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
          const element = value[i];
          if (DataUtil.isPlainObject(element)) {
            Object.assign(out, this.flattenPaths(element, `${pre}[${i}].`));
          } else {
            out[`${pre}[${i}]`] = element ?? '';
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

      for (const key of TypedObject.keys(instance)) { // Do not retain undefined fields
        if (instance[key] === undefined) {
          delete instance[key];
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
   * @param input The target object (instance of cls)
   * @param data The data to bind
   * @param config The bind configuration
   */
  static bindSchemaToObject<T>(cls: Class<T>, input: T, data?: object, config: BindConfig = {}): T {
    const view = config.view; // Does not convey
    delete config.view;

    if (!!data && isInstance<T>(data)) {
      const adapter = SchemaRegistryIndex.get(cls);
      const schemaConfig = adapter.get();

      // If no configuration
      if (!schemaConfig) {
        for (const key of TypedObject.keys(data)) {
          input[key] = data[key];
        }
      } else {
        let schema: SchemaFieldMap = schemaConfig.fields;
        if (view) {
          schema = adapter.getFields(view);
          if (!schema) {
            throw new Error(`View not found: ${view}`);
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

          let value: unknown = data[castKey<T>(inboundField)];

          // Filtering values
          if (config.filterValue && !config.filterValue(value, field)) {
            continue;
          }

          if (value !== undefined && value !== null) {
            // Ensure its an array
            if (!Array.isArray(value) && field.array) {
              if (typeof value === 'string' && value.includes(',')) {
                value = value.split(/,/).map(part => part.trim());
              } else {
                value = [value];
              }
            }

            if (SchemaRegistryIndex.has(field.type)) {
              if (field.array && Array.isArray(value)) {
                value = value.map(item => this.bindSchema(field.type, item, config));
              } else {
                value = this.bindSchema(field.type, value, config);
              }
            } else if (field.array && Array.isArray(value)) {
              value = value.map(item => this.#coerceType(field, item));
            } else {
              value = this.#coerceType(field, value);
            }
          }

          input[castKey<T>(schemaFieldName)] = castTo(value);

          if (field.accessor) {
            Object.defineProperty(input, schemaFieldName, {
              ...adapter.getAccessorDescriptor(schemaFieldName),
              enumerable: true
            });
          }
        }
      }
    }

    return input;
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
    const bindConfig: BindConfig | undefined = (complex && 'view' in config && typeof config.view === 'string') ? { view: config.view } : undefined;
    if (config.array) {
      const subValue = !Array.isArray(value) ? [value] : value;
      if (complex) {
        value = subValue.map(item => this.bindSchema(config.type, item, bindConfig));
      } else {
        value = subValue.map(item => DataUtil.coerceType(item, config.type, false));
      }
    } else {
      if (complex) {
        value = this.bindSchema(config.type, value, bindConfig);
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
    for (const field of fields) {
      params[field.index!] = this.coerceInput(field, params[field.index!], applyDefaults);
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
  static coerceMethodParams<T>(cls: Class<T>, method: string, params: unknown[], applyDefaults = true): unknown[] {
    const paramConfigs = SchemaRegistryIndex.get(cls).getMethod(method).parameters;
    return this.coerceParameters(paramConfigs, params, applyDefaults);
  }
}