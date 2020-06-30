import { Schema } from '../../../src/decorator/schema';
import { SchemaFakerUtil } from '../../../src/extension/faker';

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

export function generate() {
  const user = SchemaFakerUtil.generate(User);
  return user;
}