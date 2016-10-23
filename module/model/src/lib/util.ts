import { Model, BaseModel } from './model';
import { ObjectUtil } from '@encore/util';

export function convert<T extends BaseModel>(cls: Model<T>, o: any): T {
  if (cls.discriminiators) {
    return new cls.discriminiators[o._type](o);
  } else {
    return new cls(o);
  }
}

export function getCls<T extends BaseModel>(o: T): Model<T> {
  return o.constructor as any;
}

export function enumKeys(c: any): string[] {
  return ObjectUtil.values(c).filter(x => typeof x === 'string') as string[];
}