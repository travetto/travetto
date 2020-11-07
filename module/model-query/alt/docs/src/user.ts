import { Model } from '../../../src/registry/decorator';
import { BaseModel } from '../../../src/model/base';

@Model()
export class User extends BaseModel {
  name: string;
  age: number;
  contact?: boolean;
}
