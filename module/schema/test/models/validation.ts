import {
  Schema, Trimmed, Float, MinLength, Match, Max, Min,
  CommonRegExp, View, Url, Required, Validator
} from '../..';

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

@Schema()
export abstract class Aaaz {
  a: boolean;
}

@Schema()
export class Bbbbz extends Aaaz {
  b: number;
}

@Schema()
export class Ccccz extends Bbbbz {
  c: string;
}

@Schema()
export class AllAs {
  all: Aaaz[];
}

@Schema()
export class Response {

  @Trimmed()
  questionId: string;

  answer?: any;

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
