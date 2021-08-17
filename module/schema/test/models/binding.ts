import { Required } from '@travetto/schema/src/decorator/field';

import { Schema, View, Field, Float, Integer, Alias, Url } from '../..';
import { Address } from './address';

@Schema()
export class SuperAddress extends Address {
  @Field(String)
  unit: string;
}

@Schema()
export class RegexSimple {
  regex: RegExp;
}

@Schema()
export class Count {

  @Field(String)
  area: string;

  @Float()
  @Field(Number)
  value: number;
}

@Schema()
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

@Schema()
export class Response {

  questionId: string;
  answer?: string | boolean | number | string[];

  @Alias('correct', 'is_valid')
  valid?: boolean;

  validationCount?: number = 0;

  @Url()
  url?: string;

  status?: 'ACTIVE' | 'INACTIVE';
}

@Schema()
export abstract class BasePoly {
  type?: string;
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

@Schema()
export class Accessors {

  #area: string;
  #color: string;
  public readonly myName: string = 'name';

  @Required()
  set color(val: string) {
    this.#color = val;
  }

  get area() {
    return this.#area;
  }

  set area(val: string) {
    this.#area = val;
  }

  get optional(): string | undefined {
    return this.#area;
  }

  set optional(v: string | undefined) {

  }

  get age() {
    return this.area.length;
  }
}
