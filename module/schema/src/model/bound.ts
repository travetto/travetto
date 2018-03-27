import { BindUtil } from '../util';
import { SchemaRegistry } from '../service';
import { Class } from '@travetto/registry';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export class SchemaBound {
  static from<T>(this: new () => T, data: DeepPartial<T & { [key: string]: any }>, view?: string): T {
    return BindUtil.bindSchema(this as Class<T>, new this(), data, view);
  }
}