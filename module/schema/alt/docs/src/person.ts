import { Schema } from '../../../src/decorator/schema';
import { Integer } from '../../../src/decorator/field';

@Schema()
export class Address {
  street1: string;
  street2: string;
}

@Schema()
export class Person {
  name: string;
  @Integer() age: number;
  address: Address;
}
