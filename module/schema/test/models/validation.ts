import { TimeUnit } from '@travetto/runtime';
import {
  Schema, Float, MinLength, Match, Max, Min,
  CommonRegExp, View, Url, Required, Validator
} from '@travetto/schema';

@Schema()
@Validator((o: CustomValidated) => {
  if ((o.age + o.age2) % 2 === 0) {
    return {
      kind: 'custom',
      message: 'age1 + age2 cannot be even',
      path: 'age1'
    };
  }
})
export class CustomValidated {
  age: number;
  age2: number;
}

@Schema()
export class StringMatches {

  @Match(/^ab*c$/)
  names: string[];
}

@Schema()
export class NotRequiredUndefinable {
  @Required(false)
  name: string;
}

@Schema()
export class DateTestSchema {
  date: Date;
}

@Schema({ baseType: true })
export class Aaaaz {
  type?: string;
  a: boolean;
}

@Schema()
export class Bbbbz extends Aaaaz {
  b: number;
}

@Schema()
export class Ccccz extends Bbbbz {
  c: string;
}

@Schema()
export class AllAs {
  all: Aaaaz[];
}

@Schema()
export class Response {

  questionId: string;

  answer?: unknown;

  valid?: boolean;

  @Float()
  validationCount?: number = 0;
  timestamp: Date;

  @Url()
  url?: string;
  pandaState: 'TIRED' | 'AMOROUS' | 'HUNGRY';
}

@Schema()
export class Parent {

  response: Response;
  responses: Response[];
}

@Schema()
export class MinTest {
  @MinLength(10)
  value: string;
}

@Schema()
export class Address {
  street1: string;
  city?: string;
  zip: 200 | 500;

  @Match(CommonRegExp.postalCode)
  postal: string;
}

@Schema()
export class Nested {
  name: string;
  address: Address;
}

@Schema()
@View('profile', { with: ['name', 'address'] })
export class ViewSpecific {
  id: string;
  name: string;
  address: Address;
}

@Schema()
export class Grade {
  @Max(10)
  @Min(0)
  score: number;
}

@Schema()
export class Opaque {
  name: string;
  details: object;
  age?: number;
}

type HeightUnit = 'm' | 'ft' | undefined;

@Schema()
export class TemplateLit {
  age: `${number}-${TimeUnit}s`;
  heights?: `${number}${HeightUnit}`[];
}

@Schema()
export class RangeSchema {
  @Min(10) @Max(100)
  value: number;
}
