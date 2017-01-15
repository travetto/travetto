import { BindUtil } from '../util';
import { Cls } from '../service';

export class SchemaBound {
  constructor(data?: any) {
    BindUtil.bindSchema(this.constructor as Cls<any>, this, data);
  }
}