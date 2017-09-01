import { Field, MinLength, Url, SchemaBound, Required, SchemaValidator, Enum, Schema } from '../src';
import { expect } from 'chai';

enum PandaState {
  TIRED,
  AMOROUS,
  HUNGRY
};

@Schema()
class Response extends SchemaBound {

  @Field(String)
  @Required()
  questionId: string;

  @Field(Object)
  answer?: any;

  @Field(Boolean)
  valid?: boolean;

  @Field(Number)
  validationCount?: number = 0;

  @Url()
  @Field(String)
  url?: string;

  @Enum(PandaState)
  @Field(String)
  pandaState: string;
}

@Schema()
class Parent extends SchemaBound {

  @Field(Response)
  @Required()
  response: Response;

  @Field([Response])
  responses: Response[];
}


@Schema(true)
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