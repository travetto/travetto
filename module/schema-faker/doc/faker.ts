import { SchemaFaker } from '@travetto/schema-faker';
import { Schema } from '@travetto/schema';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  country: string;
}

@Schema()
class User {
  fName: string;
  lName: string;
  email: string;
  phone: string;
  dob?: Date;
  address: Address;
}

export function generate(): User {
  const user = SchemaFaker.generate(User);
  return user;
}