import { Schema } from '@travetto/schema';

import { Model, BaseModel } from '..';

@Schema()
export class Address {
  street1: string;
  street2?: string;
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