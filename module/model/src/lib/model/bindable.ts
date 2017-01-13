import { bindData } from '../util';
import { Cls } from '../service';

export class Bindable {
  constructor(data?: any) {
    bindData(this.constructor as Cls<any>, this, data);
  }
}