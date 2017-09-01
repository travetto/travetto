import { Cls, SchemaRegistry } from '../service';

export class BindUtil {

  static coerceType<T>(type: Cls<T>, val: any): T {
    if (val.constructor !== type) {
      let atype = type as Cls<any>;
      if (atype === Boolean) {
        if (typeof val === 'string') {
          val = val === 'true';
        } else {
          val = !!val;
        }
      } else if (atype === Number) {
        val = parseInt(`${val}`, 10);
      } else if (atype === String) {
        val = `${val}`;
      }
    }
    return val as T;
  }

  static bindSchema<T>(cons: Cls<any>, obj: T, data?: any, view: string = SchemaRegistry.DEFAULT_VIEW): T {
    if (!!data) {
      let conf = SchemaRegistry.schemas.get(cons);

      // If no configuration
      if (!conf) {
        for (let k of Object.keys(data)) {
          (obj as any)[k] = data[k];
        }
      } else {
        let viewConf = conf && conf.views[view];
        if (!viewConf) {
          throw new Error(`View not found: ${view}`);
        }
        for (let schemaFieldName of viewConf.fields) {
          let inboundField: string | undefined = undefined;

          if (schemaFieldName in data) {
            inboundField = schemaFieldName;
          } else if (viewConf.schema[schemaFieldName].aliases) {
            for (let aliasedField of (viewConf.schema[schemaFieldName].aliases || [])) {
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
            let declared = viewConf.schema[schemaFieldName].declared;
            // Ensure its an array
            if (!Array.isArray(v) && declared.array) {
              v = [v];
            }

            if (SchemaRegistry.schemas.has(declared.type)) {
              if (declared.array) {
                v = v.map((x: any) => BindUtil.bindSchema(declared.type, new declared.type(), x, view));
              } else {
                v = BindUtil.bindSchema(declared.type, new declared.type(), v, view);
              }
            } else {
              v = declared.array ?
                v.map((e: any) => BindUtil.coerceType(declared.type, e)) :
                BindUtil.coerceType(declared.type, v);
            }
          }

          (obj as any)[schemaFieldName] = v;
        }
      }
    }

    return obj;
  }
}