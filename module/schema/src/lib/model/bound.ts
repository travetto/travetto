import { BindUtil } from '../util';

export class SchemaBound {
  static from<T>(this: new () => T, data: any): T {
    return BindUtil.bindSchema(this, new this(), data);
  }
}