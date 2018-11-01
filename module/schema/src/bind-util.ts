import { Class } from '@travetto/registry';
import { SchemaRegistry } from './registry';
import { FieldConfig, DEFAULT_VIEW } from './types';

export class BindUtil {

  static expandPaths(obj: { [key: string]: any }) {
    const out: { [key: string]: any } = {};
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

  static coerceType<T>(conf: FieldConfig, val: any): T {
    const type = conf.type;

    if (type === Number) {
      if (conf.precision && conf.precision[1]) {
        val = +parseFloat(`${val}`).toFixed(conf.precision[1]);
      } else {
        val = parseInt(`${val}`, 10);
      }
    } else if (val.constructor !== type) {
      if (type === Boolean) {
        if (typeof val === 'string') {
          val = val === 'true';
        } else {
          val = !!val;
        }
      } else if (type === String) {
        val = `${val}`;
      } else if (type === Date) {
        if (typeof val === 'number' || (typeof val === 'string' && val)) {
          val = new Date(val);
        }
      }
    }

    return val as T;
  }

  static bindSchema<T>(cons: Class<T>, obj: T, data?: any, view?: string): T {
    view = view || DEFAULT_VIEW;

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
            for (const aliasedField of (viewConf.schema[schemaFieldName].aliases || [])) {
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
                v = v.map((x: any) => BindUtil.bindSchema(config.type, new config.type(), x));
              } else {
                v = BindUtil.bindSchema(config.type, new config.type(), v);
              }
            } else {
              v = config.array ?
                v.map((e: any) => BindUtil.coerceType(config, e)) :
                BindUtil.coerceType(config, v);
            }
          }

          (obj as any)[schemaFieldName] = v;
        }
      }
    }

    return obj;
  }
}