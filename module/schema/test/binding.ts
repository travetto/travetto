import {
  Field, Url, View, Required, Alias,
  BindUtil, Schema, SchemaRegistry, Float, Integer
} from '../';
import { Address } from './address';
import * as assert from 'assert';
import { Test, Suite, BeforeAll } from '@travetto/test';

@Schema(false)
class SuperAddress extends Address {
  @Field(String)
  unit: string;
}

@Schema(false)
class Count {

  @Field(String)
  area: string;

  @Float()
  @Field(Number)
  value: number;
}

@Schema(true)
class Person {

  name: string;

  dob: Date;

  @Integer()
  age: number;

  @View('test')
  address: Address;

  @View('test')
  @Field([Count])
  counts: Count[];
}

@Schema(true)
export class Response {

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
    const person = Person.fromRaw({
      name: 'Test',
      age: 19.999978,
      // dob: '2018-01-01',
      dob: 1514764800000,
      address: {
        street1: '1234 Fun',
        street2: 'Unit 20'
      },
      counts: [
        { area: 'A', value: 20.55555 },
        { area: 'B', value: 30 }
      ]
    });

    const a = 30;
    assert(person.age === 19);
    assert(person.address instanceof Address);
    assert(person.dob instanceof Date);
    assert(person.dob.toISOString() === '2018-01-01T00:00:00.000Z');
    assert(person.address.street1 === '1234 Fun');
    assert(person.counts.length === 2);
    assert(person.counts[0] instanceof Count);
    assert(person.counts[0].value === 20.55555);

    const viewPerson = Person.from({
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
    assert(viewPerson.address.street2 === 'Unit 20');
    assert(viewPerson.counts.length === 2);
    assert(viewPerson.counts[0] instanceof Count);
    assert(viewPerson.counts[0].value === 20);
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
      status: 'orange',
      valid: 'true'
    } as any);

    console.log(res);

    assert(res.valid);
  }

  @Test('Should handle aliases')
  validateExpand() {
    assert(BindUtil.expandPaths({ 'a.b.c[]': 20 }) === { a: { b: { c: [20] } } });
    assert(BindUtil.expandPaths({ 'a.d[0].c': 20 }) === { a: { d: [{ c: 20 }] } });
  }
}
