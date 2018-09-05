import * as assert from 'assert';

import { Suite, Test, BeforeAll, ShouldThrow } from '@travetto/test';

import {
  MinLength, Url,
  SchemaValidator, Schema, ValidationError,
  SchemaRegistry, ValidationErrors, Validator, View, Match, CommonRegExp
} from '../';

@Schema()
class Response {

  questionId: string;
  answer?: any;
  valid?: boolean;
  validationCount?: number = 0;
  timestamp: Date;
  @Url()
  url?: string;
  pandaState: 'TIRED' | 'AMOROUS' | 'HUNGRY';
}

@Schema()
class Parent {

  response: Response;
  responses: Response[];
}

@Schema()
class MinTest {
  @MinLength(10)
  value: string;
}

@Schema()
class Address {
  street1: string;
  city?: string;
  zip: 200 | 500;

  @Match(CommonRegExp.postal_code)
  postal: string;
}

@Schema()
class Nested {
  name: string;
  address: Address;
}

@Schema()
class ViewSpecific {
  id: string;

  @View('profile')
  name: string;

  @View('profile')
  address: Address;
}

@Schema()
@Validator((o: any) => {
  if ((o.age + o.age2) % 2 === 0) {
    return {
      kind: 'custom',
      message: 'age1 + age2 cannot be even',
      path: 'age1'
    };
  }
})
class CustomValidated {
  age: number;
  age2: number;
}

function findError(errors: ValidationError[], path: string, message: string) {
  return errors.find(x => x.path === path && x.message.includes(message));
}

@Suite()
class Validation {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test('Url and message')
  async urlAndMessage() {
    const r = Response.from({
      url: 'htt://google'
    });
    try {
      await SchemaValidator.validate(r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.log(e);
      assert(findError(e.errors, 'url', 'not a valid url'));
      assert(findError(e.errors, 'timestamp', 'is required'));
    }
  }

  @Test('Should validate nested')
  async nested() {
    const res = Parent.fromRaw({
      response: {
        url: 'a.b',
        pandaState: 'orange'
      },
      responses: []
    });
    try {
      await SchemaValidator.validate(res);
      assert.fail('Validation should have failed');
    } catch (e) {
      assert(findError(e.errors, 'responses', 'required'));
      assert(findError(e.errors, 'response.pandaState', 'TIRED'));
      assert(findError(e.errors, 'response.url', 'not a valid url'));
      assert(findError(e.errors, 'response.timestamp', 'is required'));
    }
  }

  @Test('Should ensure message for min')
  @ShouldThrow(ValidationErrors)
  async minMessage() {
    const o = MinTest.from({ value: 'hello' });

    await SchemaValidator.validate(o);
  }

  @Test('Nested validations should be fine')
  async nestedObject() {
    const obj = Nested.from({
      name: 'bob',
      address: {
        street1: 'abc',
        city: 'city',
        zip: 200,
        postal: '55555'
      }
    });

    const o = await SchemaValidator.validate(obj);
    assert(o !== undefined);
  }

  @Test('Nested validations should be fine')
  @ShouldThrow(ValidationErrors)
  async nestedObjectErrors() {
    const obj = Nested.fromRaw({
      name: 5,
      address: {
        street1: 'abc',
        city: 'city',
        zip: 400
      }
    });

    await SchemaValidator.validate(obj);
  }

  @Test('Custom Validators')
  async validateFields() {
    const obj = CustomValidated.from({
      age: 200,
      age2: 10
    });

    try {
      await SchemaValidator.validate(obj);
      assert(false);
    } catch (e) {
      assert((e as ValidationErrors).errors[0].path === 'age1');
      assert((e as ValidationErrors).errors[0].kind === 'custom');
      assert((e as ValidationErrors).errors[0].message === 'age1 + age2 cannot be even');
    }
  }

  @Test('Nested view')
  async validateViewsNested() {
    const obj = ViewSpecific.from({
      name: 'bob',
      address: {
        street1: '5',
        zip: 200,
        postal: '55555'
      }
    }, 'profile');

    await SchemaValidator.validate(obj, 'profile');
  }
}
