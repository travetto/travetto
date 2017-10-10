import { Model, BaseModel } from '../index';

@Model()
export class Address extends BaseModel {
  street1: string;

  street2: string;
}

@Model()
export class Person extends BaseModel {
  name: string;
  age: number;
  address: Address;
}