import { Class } from '@travetto/registry';
import { SchemaRegistry } from './service/registry';
import { FieldConfig, ALL_VIEW } from './service/types';
import { Util } from '@travetto/base';

// TODO: Document
export class BindUtil {

  static register() {
    const proto = Object.getPrototypeOf(Function);
    proto.fromRaw = proto.from = function (data: any, view?: string) {
      return BindUtil.bindSchema(this, data, view);
    };
  }

  static expandPaths(obj: Record<string, any>) {
    const out: Record<string, any> = {};
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
        sub = sub[name];

        if (idx && key !== undefined) {
          if (sub[key] === undefined) {
            sub[key] = {};
          }
          sub = sub[key];
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
          sub = sub[name];
          if (key === undefined) {
            key = sub.length;
          }
          sub[key!] = val;
        }
      }
    }
    return out;
  }

  static coerceType<T>(conf: FieldConfig, val: any): T | null | undefined {
    if (conf.type.bindSchema) {
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

  static bindSchema<T>(cons: Class<T>, data?: undefined, view?: string): undefined;
  static bindSchema<T>(cons: Class<T>, data?: null, view?: string): null;
  static bindSchema<T>(cons: Class<T>, data?: any, view?: string): T;
  static bindSchema<T>(cons: Class<T>, data?: any, view?: string): T | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    const cls = SchemaRegistry.resolveSubTypeForInstance(cons, data);
    if (data instanceof cls) {
      return data;
    } else {
      return this.bindSchemaToObject(cls, new cls(), data, view);
    }
  }

  static bindSchemaToObject<T>(cons: Class<T>, obj: T, data?: any, view?: string): T {
    view = view ?? ALL_VIEW;

    if (!!data) {
      const conf = SchemaRegistry.get(cons);

      // If no configuration
      if (!conf) {
        for (const k of Object.keys(data)) {
          (obj as any)[k] = data[k];
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

          let v = data[inboundField];

          if (v !== undefined && v !== null) {
            const config = viewConf.schema[schemaFieldName];

            // Ensure its an array
            if (!Array.isArray(v) && config.array) {
              v = [v];
            }

            if (SchemaRegistry.has(config.type)) {
              if (config.array) {
                v = v.map((el: any) => this.bindSchema(config.type, el));
              } else {
                v = this.bindSchema(config.type, v);
              }
            } else if (config.array) {
              v = v.map((el: any) => this.coerceType(config, el));
            } else {
              v = this.coerceType(config, v);
            }
          }

          (obj as any)[schemaFieldName] = v;
        }
      }
    }

    return obj;
  }
}