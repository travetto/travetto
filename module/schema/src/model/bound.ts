import { BindUtil } from '../util';
import { SchemaRegistry } from '../service';

export class SchemaBound {
  static from<T>(this: new () => T, data: any, view: string = SchemaRegistry.DEFAULT_VIEW): T {
    return BindUtil.bindSchema(this as any, new this(), data, view);
  }
}