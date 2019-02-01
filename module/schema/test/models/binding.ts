import { Schema, View, Field, Float, Integer, Alias, Url } from '../..';
import { Address } from './address';

@Schema(false)
export class SuperAddress extends Address {
  @Field(String)
  unit: string;
}

@Schema()
export class RegexSimple {
  regex: RegExp;
}

@Schema(false)
export class Count {

  @Field(String)
  area: string;

  @Float()
  @Field(Number)
  value: number;
}

@Schema(true)
@View('test', { with: ['address', 'counts'] })
export class Person {

  name: string;

  dob: Date;

  @Integer()
  age: number;

  address: Address;

  @Field([Count])
  counts: Count[];
}

@Schema(true)
export class Response {

  questionId: string;
  answer?: any;

  @Alias('correct', 'is_valid')
  valid?: boolean;

  validationCount?: number = 0;

  @Url()
  url?: string;

  status?: 'ACTIVE' | 'INACTIVE';
}

@Schema()
export abstract class BasePoly {
  private type: string;
  constructor() {
    this.type = this.constructor.__id;
  }
}

@Schema()
export class Poly1 extends BasePoly {
  name: string;
  age: number;
}

@Schema()
export class Poly2 extends BasePoly {
  names: string[];
  age: string;
}