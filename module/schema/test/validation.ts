import 'mocha';
import { Field, MinLength, Url, SchemaBound, Required, SchemaValidator, Enum, Schema } from '../src';
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

  @Required()
  response: Response;
  responses: Response[];
}

@Schema()
class MinTest extends SchemaBound {
  @MinLength(10)
  value: string;
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
      expect(e.errors.url.message).to.include('not a valid url');
    }
  });

  it('Should validate nested', async () => {
    let res = Parent.from({
      response: {
        url: 'a.b',
        pandaState: 'orange'
      },
      responses: [{}]
    });
    try {
      await SchemaValidator.validate(res);
      expect(true).to.equal(false);
    } catch (e) {
      expect(e.errors['response.url'].message).to.include('not a valid url');
    }
  });

  it('Should ensure message for min', async () => {
    let o = MinTest.from({ value: 'hello' });

    try {
      await SchemaValidator.validate(o);
      expect(true).to.equal(false);
    } catch (e) {
      expect(e.errors['value'].message).to.include('value is not long enough (10)');
    }
  });
});