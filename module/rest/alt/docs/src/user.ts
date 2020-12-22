// @file-if @travetto/model-core
import { Model, BaseModel } from '@travetto/model-core';

@Model()
export class User extends BaseModel {
  name: string;
  age: number;
  contact?: boolean;
}
