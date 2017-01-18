import { Field, Url, SchemaBound, Required, SchemaValidator } from '../lib';
import { expect } from 'chai';


export class Response extends SchemaBound {

  @Field(String)
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
});