import { castTo, Class, classConstruct, asFull, TypedObject, castKey } from '@travetto/runtime';

import { DataUtil } from './data.ts';
import { SchemaRegistry } from './service/registry.ts';
import { FieldConfig } from './service/types.ts';

type BindConfig = {
  view?: string;
  filterField?: (field: FieldConfig) => boolean;
  filterValue?: (value: unknown, field: FieldConfig) => boolean;
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
   * @param val The provided value
   */
  static #coerceType<T>(conf: FieldConfig, val: unknown): T | null | undefined {
    if (conf.type?.bindSchema) {
      val = conf.type.bindSchema(val);
    } else {
      val = DataUtil.coerceType(val, conf.type, false);

      if (conf.type === Number && conf.precision && typeof val === 'number') {
        if (conf.precision[1]) { // Supports decimal
          val = +val.toFixed(conf.precision[1]);
        } else { // 0 digits
          val = Math.trunc(val);
        }
      }
    }
    return castTo(val);
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
      const val = DataUtil.isPlainObject(objK) ? this.expandPaths(objK) : objK;
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
        if (sub[last] && DataUtil.isPlainObject(val)) {
          sub[last] = DataUtil.deepAssign(sub[last], val, 'coerce');
        } else {
          sub[last] = val;
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
        if (arrSub[key] && DataUtil.isPlainObject(val) && DataUtil.isPlainObject(arrSub[key])) {
          arrSub[key] = DataUtil.deepAssign(arrSub[key], val, 'coerce');
        } else {
          arrSub[key] = val;
        }
      }
    }
    return out;
  }

  /**
   * Convert full object with nesting, into flat set of keys
   * @param conf The object to flatten the paths for
   * @param val The starting prefix
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
   * @param cons The schema class to bind against
   * @param data The provided data to bind
   * @param cfg The bind configuration
   */
  static bindSchema<T>(cons: Class<T>, data?: undefined, cfg?: BindConfig): undefined;
  static bindSchema<T>(cons: Class<T>, data?: null, cfg?: BindConfig): null;
  static bindSchema<T>(cons: Class<T>, data?: object | T, cfg?: BindConfig): T;
  static bindSchema<T>(cons: Class<T>, data?: object | T, cfg?: BindConfig): T | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    const cls = SchemaRegistry.resolveInstanceType<T>(cons, asFull<T>(data));
    if (data instanceof cls) {
      return castTo(data);
    } else {
      const tgt = classConstruct<T & { type?: string }>(cls);
      SchemaRegistry.ensureInstanceTypeField(cls, tgt);

      for (const k of TypedObject.keys(tgt)) { // Do not retain undefined fields
        if (tgt[k] === undefined) {
          delete tgt[k];
        }
      }
      return this.bindSchemaToObject(cls, tgt, data, cfg);
    }
  }

  /**
   * Bind the schema to the object
   * @param cons The schema class
   * @param obj The target object (instance of cons)
   * @param data The data to bind
   * @param cfg The bind configuration
   */
  static bindSchemaToObject<T>(cons: Class<T>, obj: T, data?: object, cfg: BindConfig = {}): T {
    const view = cfg.view; // Does not convey
    delete cfg.view;

    if (!!data && isInstance<T>(data)) {
      const conf = SchemaRegistry.get(cons);

      // If no configuration
      if (!conf) {
        for (const k of TypedObject.keys(data)) {
          obj[k] = data[k];
        }
      } else {
        let viewConf = conf.totalView;
        if (view) {
          viewConf = conf.views[view];
          if (!viewConf) {
            throw new Error(`View not found: ${view.toString()}`);
          }
        }

        for (const schemaFieldName of viewConf.fields) {
          const field = viewConf.schema[schemaFieldName];

          let inboundField: string | undefined = undefined;
          if (field.access === 'readonly' || cfg.filterField?.(field) === false) {
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
          if (cfg.filterValue && !cfg.filterValue(v, field)) {
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

            if (SchemaRegistry.has(field.type)) {
              if (field.array && Array.isArray(v)) {
                v = v.map(el => this.bindSchema(field.type, el, cfg));
              } else {
                v = this.bindSchema(field.type, v, cfg);
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
              ...SchemaRegistry.getAccessorDescriptor(cons, schemaFieldName),
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
   * @param field
   * @param val
   * @param applyDefaults
   * @returns
   */
  static coerceField(field: FieldConfig, val: unknown, applyDefaults = false): unknown {
    if ((val === undefined || val === null) && applyDefaults) {
      val = Array.isArray(field.default) ? field.default.slice(0) : field.default;
    }
    if (!field.required && (val === undefined || val === null)) {
      return val;
    }
    const complex = SchemaRegistry.has(field.type);
    if (field.array) {
      const valArr = !Array.isArray(val) ? [val] : val;
      if (complex) {
        val = valArr.map(x => this.bindSchema(field.type, x, { view: field.view }));
      } else {
        val = valArr.map(x => DataUtil.coerceType(x, field.type, false));
      }
    } else {
      if (complex) {
        val = this.bindSchema(field.type, val, { view: field.view });
      } else {
        val = DataUtil.coerceType(val, field.type, false);
      }
    }
    return val;
  }

  /**
   * Coerce multiple params at once
   * @param fields
   * @param params
   * @returns
   */
  static coerceFields(fields: FieldConfig[], params: unknown[], applyDefaults = true): unknown[] {
    params = [...params];
    // Coerce types
    for (const el of fields) {
      params[el.index!] = this.coerceField(el, params[el.index!], applyDefaults);
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
    return this.coerceFields(SchemaRegistry.getMethodSchema(cls, method), params, applyDefaults);
  }
}