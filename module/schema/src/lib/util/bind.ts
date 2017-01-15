import { Cls, SchemaRegistry } from '../service';

export class BindUtil {

  static convert<T>(cls: Cls<T>, o: T, discriminatorField: string = '_type'): T {
    let config = SchemaRegistry.schemas[cls.name];
    if (discriminatorField && config && config.subtypes && !!(o as any)[discriminatorField]) {
      return new config.subtypes[(o as any)[discriminatorField]](o);
    } else {
      return new cls(o);
    }
  }

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
      let conf = SchemaRegistry.schemas[cons.name];

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
        for (let f of viewConf.fields) {
          if (data.hasOwnProperty(f)) {

            let v = data[f];

            if (v !== undefined && v !== null) {
              let declared = viewConf.schema[f].declared;
              // Ensure its an array
              if (!Array.isArray(v) && declared.array) {
                v = [v];
              }

              if (SchemaRegistry.schemas[declared.type.name]) {
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

            (obj as any)[f] = v;
          }
        }
      }
    }

    return obj;
  }
}