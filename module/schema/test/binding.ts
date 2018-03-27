import { Field, Url, SchemaBound, View, Required, Alias, BindUtil, Schema, SchemaRegistry } from '../src';
import { Address } from './address';
import * as assert from 'assert';
import { Test, Suite, BeforeAll } from '@travetto/test';

console.log('Hello')
@Schema(false)
class SuperAddress extends Address {
  @Field(String)
  unit: string;
}

@Schema(false)
class Count extends SchemaBound {

  @Field(String)
  @View('test')
  area: string;

  @Field(Number)
  value: number;
}

@Schema(true)
class Person extends SchemaBound {

  name: string;

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

  status?: 'ACTIVE' | 'INACTIVE';
}

@Suite('Data Binding')
class DataBinding {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test('Validate bind')
  validateBind() {
    const person = Person.from({
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
    assert(person.address instanceof Address);
    assert(person.address.street1 === '1234 Fun');
    assert(person.counts.length === 2);
    assert(person.counts[0] instanceof Count);

    const viewPerson = BindUtil.bindSchema(Person, new Person(), {
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

    assert(viewPerson.address instanceof Address);
    assert(viewPerson.address.street1 === '1234 Fun');
    assert(viewPerson.address.street2 === undefined);
    assert(viewPerson.counts.length === 2);
    assert(viewPerson.counts[0] instanceof Count);
    assert(viewPerson.counts[0].value === undefined);
  }

  @Test('Validate Object')
  validateObject() {
    const res = Response.from({
      questionId: '20',
      answer: ['a', 'd']
    });
    assert(res.questionId === '20');
    assert(!!res.answer);
    assert(res.answer === ['a', 'd']);
  }

  @Test('Should handle inheritance')
  validateInheritance() {
    const res = SuperAddress.from({
      street1: 'a',
      street2: 'b',
      unit: '20'
    } as any);
    assert(res.unit === '20');
  }

  @Test('Should handle aliases')
  validateAliases() {
    const res = Response.from({
      correct: true,
      status: 'orange'
    } as any);

    console.log(res);

    assert(res.valid);
  }
}