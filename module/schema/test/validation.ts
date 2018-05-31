import {
  Field, MinLength, Url, Required,
  SchemaValidator, Enum, Schema, ValidationError,
  SchemaRegistry, ValidationErrors, Validator, ClassWithSchema
} from '../src';
import { Suite, Test, BeforeAll, ShouldThrow } from '@travetto/test';
import * as assert from 'assert';

@Schema()
class Response {

  questionId: string;
  answer?: any;
  valid?: boolean;
  validationCount?: number = 0;
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
}

@Schema()
class Nested {
  name: string;
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
    const r = (Response as ClassWithSchema<Response>).from({
      url: 'htt://google'
    } as any);
    try {
      await SchemaValidator.validate(r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.log(e);
      assert(findError(e.errors, 'url', 'not a valid url'));
    }
  }

  @Test('Should validate nested')
  async nested() {
    const res = (Parent as ClassWithSchema<Parent>).from({
      response: {
        url: 'a.b',
        pandaState: 'orange'
      },
      responses: []
    } as any); // To allow for validating
    try {
      await SchemaValidator.validate(res);
      assert.fail('Validation should have failed');
    } catch (e) {
      assert(findError(e.errors, 'responses', 'required'));
      assert(findError(e.errors, 'response.pandaState', 'TIRED'));
      assert(findError(e.errors, 'response.url', 'not a valid url'));
    }
  }

  @Test('Should ensure message for min')
  @ShouldThrow(ValidationErrors)
  async minMessage() {
    const o = (MinTest as ClassWithSchema<MinTest>).from({ value: 'hello' });

    await SchemaValidator.validate(o);
  }

  @Test('Nested validations should be fine')
  async nestedObject() {
    const obj = (Nested as ClassWithSchema<Nested>).from({
      name: 'bob',
      address: {
        street1: 'abc',
        city: 'city',
        zip: 200
      }
    });

    const o = await SchemaValidator.validate(obj);
    assert(o !== undefined);
  }

  @Test('Nested validations should be fine')
  @ShouldThrow(ValidationErrors)
  async nestedObjectErrors() {
    const obj = (Nested as ClassWithSchema<Nested>).from({
      name: 5,
      address: {
        street1: 'abc',
        city: 'city',
        zip: 400
      }
    } as any);

    await SchemaValidator.validate(obj);
  }

  @Test('Custom Validators')
  async validateFields() {
    const obj = (CustomValidated as ClassWithSchema<CustomValidated>).from({
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
}
