import { Field, MinLength, Url, SchemaBound, Required, SchemaValidator, Enum, Schema, ValidationError, SchemaRegistry } from '../src';
import { Suite, Test, BeforeAll } from '@encore2/test';
import * as assert from 'assert';

@Schema()
class Response extends SchemaBound {

  questionId: string;
  answer?: any;
  valid?: boolean;
  validationCount?: number = 0;
  @Url()
  url?: string;
  pandaState: 'TIRED' | 'AMOROUS' | 'HUNGRY';
}

@Schema()
class Parent extends SchemaBound {

  response: Response;
  responses: Response[];
}

@Schema()
class MinTest extends SchemaBound {
  @MinLength(10)
  value: string;
}

function findError(errors: ValidationError[], path: string, message: string) {
  if (Math.random() > 0) {
    //throw new Error('Ruh roh raggy');
  }
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
    let r = Response.from({
      url: 'htt://google'
    });
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
    let res = Parent.from({
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
  async minMessage() {
    let o = MinTest.from({ value: 'hello' });

    try {
      await SchemaValidator.validate(o);
      assert.fail('Validation should have failed');
    } catch (e) {
      assert(findError(e.errors, 'value', 'value is not long enough (10)'));
    }
  }
}