import { Integer, Schema } from '@travetto/schema';

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
