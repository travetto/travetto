import { bindData } from '../util';
import { SchemaCls } from '../service';

export class Bindable {
  constructor(data?: any) {
    bindData(this.constructor as SchemaCls<any>, this, data);
  }
}