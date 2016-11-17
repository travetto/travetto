import { BaseModel } from './model';
import { ModelCls, models, getModelConfig, DEFAULT_VIEW } from './service/registry';
import { ObjectUtil } from '@encore/util';

export function convert<T extends BaseModel>(cls: ModelCls<T>, o: T): T {
  let config = models[cls.name];
  if (config && config.discriminated && !!o._type) {
    return new config.discriminated[o._type](o);
  } else {
    return new cls(o);
  }
}

export function getCls<T extends BaseModel>(o: T): ModelCls<T> {
  return o.constructor as any;
}

export function enumKeys(c: any): string[] {
  return ObjectUtil.values(c).filter((x: any) => typeof x === 'string') as string[];
}

export function bindData<T>(obj: T, data?: any, view: string = DEFAULT_VIEW): T {
  let cons = obj.constructor as any;
  let conf = models[cons.name];

  if (!conf || (view === DEFAULT_VIEW && conf.schemaOpts && conf.schemaOpts.strict === false)) {
    for (var k in data) {
      (obj as any)[k] = data[k];
    }
  } else if (!!data) {
    let viewConf = conf.views[view];
    if (!viewConf) {
      throw new Error(`View not found: ${view}`)
    }
    if (viewConf.fields) {
      viewConf.fields.forEach((f: string) => {
        if (data[f] !== undefined) {
          (obj as any)[f] = data[f];
        }
      });
    } else {
      for (let k of Object.keys(data)) {
        (obj as any)[k] = data[k];
      }
    }
  }
  return obj;
}