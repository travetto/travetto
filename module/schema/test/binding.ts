import 'mocha';

import { Field, Url, SchemaBound, View, Required, Alias, BindUtil, Schema } from '../src';
import { expect } from 'chai';

@Schema()
class Address extends SchemaBound {

  @Field(String)
  @View('test')
  @Required()
  street1: string;

  @Field(String)
  street2: string;
}

@Schema()
class SuperAddress extends Address {
  @Field(String)
  unit: string;
}

@Schema()
class Count extends SchemaBound {

  @Field(String)
  @View('test')
  area: string;

  @Field(Number)
  value: number;
}

@Schema()
class Person extends SchemaBound {

  @Field(String)
  name: string;

  @Field(Address)
  @View('test')
  address: Address;

  @View('test')
  @Field([Count])
  counts: Count[];
}

@Schema(true)
export class Response extends SchemaBound {

  questionId: string;
  answer?: any;

  @Alias('correct', 'is_valid')
  valid?: boolean;

  validationCount?: number = 0;

  @Url()
  url?: string;
}

describe('Data Binding', () => {
  it('Validate bind', () => {
    let person = Person.from({
      name: 'Test',
      address: {
        street1: '1234 Fun',
        street2: 'Unit 20'
      },
      counts: [
        { area: 'A', value: 20 },
        { area: 'B', value: 30 }
      ]
    });
    expect(person.address).instanceof(Address);
    expect(person.address.street1).to.equal('1234 Fun');
    expect(person.counts.length).to.equal(2);
    expect(person.counts[0]).instanceof(Count);

    let viewPerson = BindUtil.bindSchema(Person, new Person(), {
      name: 'Test',
      address: {
        street1: '1234 Fun',
        street2: 'Unit 20'
      },
      counts: [
        { area: 'A', value: 20 },
        { area: 'B', value: 30 }
      ]
    }, 'test');

    expect(viewPerson.address).instanceof(Address);
    expect(viewPerson.address.street1).to.equal('1234 Fun');
    expect(viewPerson.address.street2).to.equal(undefined);
    expect(viewPerson.counts.length).to.equal(2);
    expect(viewPerson.counts[0]).instanceof(Count);
    expect(viewPerson.counts[0].value).to.equal(undefined);
  });

  it('Validate Object', () => {
    let res = Response.from({
      questionId: '20',
      answer: ['a', 'd']
    });
    expect(res.questionId).to.equal('20');
    expect(res.answer).to.not.equal(undefined);
    expect(res.answer).to.deep.equal(['a', 'd']);
  });

  it('Should handle inheritance', () => {
    let res = SuperAddress.from({
      street1: 'a',
      street2: 'b',
      unit: '20'
    });
    expect(res.unit).to.equal('20');
  });

  it('Should handle aliases', () => {
    let res = Response.from({
      correct: true
    });
    expect(res.valid).to.equal(true);
  });
});