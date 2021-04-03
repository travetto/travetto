import { Class, ClassInstance, ConcreteClass, Util } from '@travetto/base';

import { SchemaRegistry } from './service/registry';
import { FieldConfig, ALL_VIEW } from './service/types';

/**
 * Utilities for binding objects to schemas
 */
export class BindUtil {

  /**
   * Register `from` on the Function prototype
   */
  static register() {
    const proto = Object.getPrototypeOf(Function);
    proto.from = function (data: object | ClassInstance, view?: string) {
      return BindUtil.bindSchema(this, data, view);
    };
  }

  /**
   * Convert dotted paths into a full object
   *
   * This will convert `{ 'a.b[3].c[age]': 5 }` => `{ a : { b : [,,,{ c: { age: 5 }}]}}`
   *
   * @param obj The object to convert
   */
  static expandPaths(obj: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const val = obj[k];
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
        sub = sub[name] as Record<string, unknown>;

        if (idx && key !== undefined) {
          if (sub[key] === undefined) {
            sub[key] = {};
          }
          sub = sub[key] as Record<string, unknown>;
        }
      }

      if (last.indexOf('[') < 0) {
        sub[last] = val;
      } else {
        const arr = last.indexOf('[') > 0;
        const name = last.split(/[^A-Za-z_0-9]/)[0];
        const idx = arr ? last.split(/[\[\]]/)[1] : '';
        let key = arr ? (/^\d+$/.test(idx) ? parseInt(idx, 10) : (idx.trim() || undefined)) : undefined;
        if (sub[name] === undefined) {
          sub[name] = (typeof key === 'string') ? {} : [];
          sub = sub[name] as Record<string, unknown>;
          if (key === undefined) {
            key = sub.length as number;
          }
          sub[key!] = val;
        }
      }
    }
    return out;
  }

  /**
   * Coerce a value to match the field config type
   * @param conf The field config to coerce to
   * @param val The provided value
   */
  static coerceType<T>(conf: FieldConfig, val: unknown): T | null | undefined {
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
    return val as T;
  }

  /**
   * Bind data to the schema for a class, with an optional view
   * @param cons The schema class to bind against
   * @param data The provided data to bind
   * @param view The optional view to limit the binding against
   */
  static bindSchema<T>(cons: Class<T>, data?: undefined, view?: string): undefined;
  static bindSchema<T>(cons: Class<T>, data?: null, view?: string): null;
  static bindSchema<T>(cons: Class<T>, data?: object | T, view?: string): T;
  static bindSchema<T>(cons: Class<T>, data?: object | T, view?: string): T | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    const cls = SchemaRegistry.resolveSubTypeForInstance(cons, data) as Class<T>;
    if (data instanceof cls) {
      return data as T;
    } else {
      const tgt = new (cls as ConcreteClass<T>)();
      for (const k in tgt) { // Do not retain undefined fields
        if (tgt[k] === undefined) {
          delete tgt[k];
        }
      }
      return this.bindSchemaToObject(cls, tgt, data as object, view);
    }
  }

  /**
   * Bind the schema to the object
   * @param cons The schema class
   * @param obj The target object (instance of cons)
   * @param data The data to bind
   * @param view The desired view
   */
  static bindSchemaToObject<T>(cons: Class<T>, obj: T, data?: object, view?: string): T {
    view = view ?? ALL_VIEW;

    if (!!data) {
      const conf = SchemaRegistry.get(cons);

      // If no configuration
      if (!conf) {
        for (const k of Object.keys(data) as (keyof typeof obj)[]) {
          obj[k] = data[k as keyof typeof data];
        }
      } else {

        const viewConf = conf && conf.views[view];
        if (!viewConf) {
          throw new Error(`View not found: ${view}`);
        }

        for (const schemaFieldName of viewConf.fields) {
          let inboundField: string | undefined = undefined;

          if (schemaFieldName in data) {
            inboundField = schemaFieldName;
          } else if (viewConf.schema[schemaFieldName].aliases) {
            for (const aliasedField of (viewConf.schema[schemaFieldName].aliases ?? [])) {
              if (aliasedField in data) {
                inboundField = aliasedField;
                break;
              }
            }
          }

          if (!inboundField) {
            continue;
          }

          let v = data[inboundField as keyof typeof data] as unknown;

          if (v !== undefined && v !== null) {
            const config = viewConf.schema[schemaFieldName];

            // Ensure its an array
            if (!Array.isArray(v) && config.array) {
              v = [v];
            }

            if (SchemaRegistry.has(config.type)) {
              if (config.array && Array.isArray(v)) {
                v = v.map(el => this.bindSchema(config.type, el));
              } else {
                v = this.bindSchema(config.type, v);
              }
            } else if (config.array && Array.isArray(v)) {
              v = v.map(el => this.coerceType(config, el));
            } else {
              v = this.coerceType(config, v);
            }
          }

          obj[schemaFieldName as keyof typeof obj] = v as (typeof obj)[keyof typeof obj];
        }
      }
    }

    return obj;
  }
}