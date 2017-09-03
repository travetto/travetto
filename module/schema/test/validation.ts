import 'mocha';
import { Field, MinLength, Url, SchemaBound, Required, SchemaValidator, Enum, Schema, ValidationError } from '../src';
import { expect } from 'chai';

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
  expect(errors.find(x => x.path === path && x.message.includes(message)), `Expecting ${path} to have error ${message}`).is.not.undefined
}

describe('Validation', () => {
  it('Url and message', async () => {
    let r = Response.from({
      url: 'htt://google'
    });
    try {
      await SchemaValidator.validate(r);
      expect(true).to.equal(false);
    } catch (e) {
      findError(e.errors, 'url', 'not a valid url');
    }
  });

  it('Should validate nested', async () => {
    let res = Parent.from({
      response: {
        url: 'a.b',
        pandaState: 'orange'
      },
      responses: []
    });
    try {
      await SchemaValidator.validate(res);
      expect(true).to.equal(false);
    } catch (e) {
      findError(e.errors, 'responses', 'required');
      findError(e.errors, 'response.pandaState', 'TIRED');
      findError(e.errors, 'response.url', 'not a valid url');
    }
  });

  it('Should ensure message for min', async () => {
    let o = MinTest.from({ value: 'hello' });

    try {
      await SchemaValidator.validate(o);
      expect(true).to.equal(false);
    } catch (e) {
      findError(e.errors, 'value', 'value is not long enough (10)');
    }
  });
});