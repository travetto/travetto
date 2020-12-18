import { Schema, View } from '../../..';

@Schema()
@View('login', { with: ['street1', 'city', 'street3'] })
class Address {
  street1: string;
  street2?: string;
  city: string;
  zip: number;
}

@Schema()
class Person {
  name: string;
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

setTimeout(() => {
  console.log(Person.toString());
}, 1000);