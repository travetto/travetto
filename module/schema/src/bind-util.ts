import { Class, ConcreteClass, TypedObject, Util } from '@travetto/base';

import { AllViewⲐ } from './internal/types';
import { SchemaRegistry } from './service/registry';
import { FieldConfig } from './service/types';

type BindConfig = {
  view?: string | typeof AllViewⲐ;
  filterField?: (field: FieldConfig) => boolean;
  filterValue?: (value: unknown, field: FieldConfig) => boolean;
};

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
      val = Util.coerceType(val, conf.type, false);

      if (conf.type === Number && conf.precision && typeof val === 'number') {
        if (conf.precision[1]) { // Supports decimal
          val = +val.toFixed(conf.precision[1]);
        } else { // 0 digits
          val = Math.trunc(val);
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return val as T;
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
      const val = Util.isPlainObject(objK) ? this.expandPaths(objK) : objK;
      const parts = k.split('.');
      const last = parts.pop()!;
      let sub = out;
      while (parts.length > 0) {
        const part = parts.shift()!;
        const arr = part.indexOf('[') > 0;
        const name = part.split(/[^A-Za-z_0-9]/)[0];
        const idx = arr ? part.split(/[\[\]]/)[1] : '';
        const key = arr ? (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined)) : undefined;

        if (!(name in sub)) {
          sub[name] = typeof key === 'number' ? [] : {};
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        sub = sub[name] as Record<string, unknown>;

        if (idx && key !== undefined) {
          if (sub[key] === undefined) {
            sub[key] = {};
          }
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          sub = sub[key] as Record<string, unknown>;
        }
      }

      if (last.indexOf('[') < 0) {
        if (sub[last] && Util.isPlainObject(val)) {
          sub[last] = Util.deepAssign(sub[last], val, 'coerce');
        } else {
          sub[last] = val;
        }
      } else {
        const arr = last.indexOf('[') > 0;
        const name = last.split(/[^A-Za-z_0-9]/)[0];
        const idx = arr ? last.split(/[\[\]]/)[1] : '';
        let key = arr ? (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined)) : undefined;
        if (sub[name] === undefined) {
          sub[name] = (typeof key === 'string') ? {} : [];
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          sub = sub[name] as Record<string, unknown>;
          if (key === undefined) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            key = sub.length as number;
          }
          if (sub[key] && Util.isPlainObject(val) && Util.isPlainObject(sub[key])) {
            sub[key] = Util.deepAssign(sub[key], val, 'coerce');
          } else {
            sub[key] = val;
          }
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
  static flattenPaths(data: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = `${prefix}${key}`;
      if (Util.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, `${pre}.`)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (Util.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}].`));
          } else {
            out[`${pre}[${i}]`] = v;
          }
        }
      } else {
        out[pre] = value;
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = SchemaRegistry.resolveSubTypeForInstance<T>(cons, data as T);
    if (data instanceof cls) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return data as T;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const tgt = new (cls as ConcreteClass<T>)() as T;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      SchemaRegistry.ensureInstanceTypeField(cls, tgt as T & { type?: string });

      for (const k of TypedObject.keys(tgt)) { // Do not retain undefined fields
        if (tgt[k] === undefined) {
          delete tgt[k];
        }
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return this.bindSchemaToObject(cls, tgt, data as object, cfg);
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
    const view = cfg.view ?? AllViewⲐ; // Does not convey
    delete cfg.view;

    if (!!data && !Util.isPrimitive(data)) {
      const conf = SchemaRegistry.get(cons);

      // If no configuration
      if (!conf) {
        for (const k of TypedObject.keys(data)) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          obj[k] = data[k as keyof typeof data];
        }
      } else {

        const viewConf = conf.views[view];
        if (!viewConf) {
          throw new Error(`View not found: ${view.toString()}`);
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

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          let v: unknown = data[inboundField as keyof typeof data];

          // Filtering values
          if (cfg.filterValue && !cfg.filterValue(v, field)) {
            continue;
          }

          if (v !== undefined && v !== null) {
            // Ensure its an array
            if (!Array.isArray(v) && field.array) {
              if (typeof v === 'string' && v.includes(',')) {
                v = v.split(/\s*,\s*/);
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

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          obj[schemaFieldName as keyof typeof obj] = v as (typeof obj)[keyof typeof obj];
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
      val = field.default;
    }
    const complex = SchemaRegistry.has(field.type);
    if (field.array) {
      const valArr = !Array.isArray(val) ? [val] : val;
      if (complex) {
        val = valArr.map(x => this.bindSchema(field.type, x, { view: field.view }));
      } else {
        val = valArr.map(x => Util.coerceType(x, field.type, false));
      }
    } else {
      if (complex) {
        val = this.bindSchema(field.type, val, { view: field.view });
      } else {
        val = Util.coerceType(val, field.type, false);
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
  static coerceFields(fields: FieldConfig[], params: unknown[], applyDefaults = false): unknown[] {
    params = [...params];
    // Coerce types
    for (const el of fields) {
      params[el.index!] = this.coerceField(el, params[el.index!], applyDefaults);
    }
    return params;
  }
}