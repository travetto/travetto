import { Schema, Integer, MaxLength, MinLength, Float } from '../src';

@Schema()
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
  console.log(Person);
}, 1000);