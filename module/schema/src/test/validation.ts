import { Field, Url, SchemaBound, Required, SchemaValidator } from '../lib';
import { expect } from 'chai';


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

  @Url('BAD URL')
  @Field(String)
  url?: string;
}

class Parent extends SchemaBound {

  @Field(Response)
  @Required()
  response: Response;

  @Field([Response])
  responses: Response[];
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
      expect(e.errors.url.message).to.equal('BAD URL');
    }
  });

  it('Should validate nested', async () => {
    let res = Parent.from({
      response: {
        url: 'a.b'
      },
      responses: [{}]
    });
    try {
      await SchemaValidator.validate(res);
      expect(true).to.equal(false);
    } catch (e) {
      expect(e.errors['response.url'].message).to.equal('BAD URL');
    }
  });
});