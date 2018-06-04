import { Model, BaseModel, ModelRegistry } from '@travetto/model';
import { Schema } from '@travetto/schema';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
}

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
  gender: 'm' | 'f' | 'b';
  address: Address;
}

setTimeout(() => {
  console.log(Person);
}, 1000);