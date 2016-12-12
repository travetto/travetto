import { Model, Field, Bindable, View, bindData } from '../lib';
import { expect } from 'chai';

class Address extends Bindable {

  @Field(String)
  @View('test')
  street1: string;

  @Field(String)
  street2: string;
}

class Count extends Bindable {

  @Field(String)
  @View('test')
  area: string;

  @Field(Number)
  value: number;
}

@Model()
class Person extends Bindable {

  @Field(String)
  name: string;

  @Field(Address)
  @View('test')
  address: Address;

  @View('test')
  @Field([Count])
  counts: Count[];
}

describe('Data Binding', () => {
  it('Validate bind', () => {
    let person = new Person({
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

    let viewPerson = bindData(Person, new Person(), {
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
});