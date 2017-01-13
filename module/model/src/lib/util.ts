import { ModelCore } from './model';
import { ModelCls, ModelRegistry, Cls } from './service/registry';
import { ObjectUtil } from '@encore/util';

export function convert<T extends ModelCore>(cls: ModelCls<T>, o: T): T {
  let config = ModelRegistry.models[cls.name];
  if (config && config.discriminated && !!o._type) {
    return new config.discriminated[o._type](o);
  } else {
    return new cls(o);
  }
}

export function getCls<T>(o: T): Cls<T> {
  return o.constructor as any;
}

export function enumKeys(c: any): string[] {
  return ObjectUtil.values(c).filter((x: any) => typeof x === 'string') as string[];
}

export function coerceType<T>(type: Cls<T>, val: any): T {
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

export function bindData<T>(cons: Cls<any>, obj: T, data?: any, view: string = ModelRegistry.DEFAULT_VIEW): T {
  if (!!data) {
    let conf = ModelRegistry.models[cons.name];

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

            if (ModelRegistry.models[declared.type.name]) {
              if (declared.array) {
                v = v.map((x: any) => bindData(declared.type, new declared.type(), x, view));
              } else {
                v = bindData(declared.type, new declared.type(), v, view);
              }
            } else {
              v = declared.array ?
                v.map((e: any) => coerceType(declared.type, e)) :
                coerceType(declared.type, v);
            }
          }

          (obj as any)[f] = v;
        }
      }
    }
  }

  return obj;
}