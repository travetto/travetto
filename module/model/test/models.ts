import { Model, BaseModel, WhereClause, ModelService } from '../index';

@Model()
export class Address extends BaseModel {
  street1: string;

  street2: string;
}

@Model()
export class Person extends BaseModel {
  name: string;
  names: string[];
  age: number;
  dob: Date;
  address: Address;
  extra: Address[];
}