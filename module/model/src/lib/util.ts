import { ModelCore } from './model';
import { ModelCls, models, DEFAULT_VIEW, Cls } from './service/registry';
import { ObjectUtil } from '@encore/util';

export function convert<T extends ModelCore>(cls: ModelCls<T>, o: T): T {
  let config = models[cls.name];
  if (config && config.discriminated && !!o._type) {
    return new config.discriminated[o._type](o);
  } else {
    return new cls(o);
  }
}

export function getCls<T extends ModelCore>(o: T): ModelCls<T> {
  return o.constructor as any;
}

export function enumKeys(c: any): string[] {
  return ObjectUtil.values(c).filter((x: any) => typeof x === 'string') as string[];
}

export function bindModel<T>(model: T, data?: any, view: string = DEFAULT_VIEW): T {
  return bindData(model.constructor as ModelCls<T>, model, data, view);
}

export function bindData<T>(cons: Cls, obj: T, data?: any, view: string = DEFAULT_VIEW): T {
  if (!!data) {
    let conf = models[cons.name];

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
          let declared = viewConf.schema[f].declared;

          if (models[declared.type.name]) {
            if (declared.array) {
              v = v.map((x: any) => bindModel(new declared.type(), x, view));
            } else {
              v = bindModel(new declared.type(), v, view);
            }
          }

          (obj as any)[f] = v;
        }
      }
    }
  }

  return obj;
}