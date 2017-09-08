import { BindUtil } from '../util';
import { SchemaRegistry } from '../service';
import { Class } from '@encore2/registry';

type DeepPartial<T> = {
  [p in keyof T]?: DeepPartial<T[p]>
}

export class SchemaBound {
  static from<T>(this: Class<T>, data: DeepPartial<T & { [key: string]: any }>, view?: string): T {
    return BindUtil.bindSchema(this as any, new this(), data, view);
  }
}