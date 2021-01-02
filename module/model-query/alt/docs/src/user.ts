import { Model, BaseModel } from '@travetto/model';

@Model()
export class User extends BaseModel {
  name: string;
  age: number;
  contact?: boolean;
}
