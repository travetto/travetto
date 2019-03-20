import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { Class } from '@travetto/registry';

import { BindUtil, SchemaRegistry } from '../';
import { Address } from './models/address';
import { Person, Count, Response, SuperAddress, BasePoly, Poly1, Poly2, RegexSimple } from './models/binding';

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
      age: 19.99978,
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

  @Test('Should handle nulls in arrays')
  validateNullArrays() {
    const p = Person.fromRaw({
      counts: [
        {
          area: 'a',
          value: 5
        },
        null,
        {
          area: 'b',
          value: 6
        }]
    });

    assert(p.counts);
    assert(p.counts.length === 3);
    assert(p.counts[0] instanceof Count);
    assert(p.counts[1] === null);
    assert(p.counts[2] instanceof Count);
  }

  @Test('Should handle polymorphic structure')
  validatePolymorphism() {
    const items = [
      {
        type: 'poly1',
        name: 'bob',
        names: ['1', '2', '3'],
        age: 30
      },
      {
        type: 'poly2',
        name: 'bob',
        names: ['1', '2', '3'],
        age: 30
      }
    ].map(v => {
      return (BasePoly as Class).from(v);
    });

    assert(items);
    assert(items.length === 2);
    assert(items[0] instanceof Poly1);
    assert(!items[0].names);
    assert(items[1] instanceof Poly2);
    assert(!items[1].name);
    assert(typeof items[1].age === 'string');
  }

  @Test('should handle regex fields')
  validateRegexFields() {
    const item = {
      regex: '/helloWorld/i'
    };

    const simple = BindUtil.bindSchema(RegexSimple, item);

    assert(simple.regex instanceof RegExp);
    assert(simple.regex.source === 'helloWorld');
    assert(simple.regex.ignoreCase);
    assert(!simple.regex.global);
    assert(!simple.regex.dotAll);

    const item2 = {
      regex: 'helloWorld'
    };

    const simple2 = BindUtil.bindSchema(RegexSimple, item2);

    assert(simple2.regex instanceof RegExp);
    assert(simple2.regex.source === 'helloWorld');
    assert(!simple2.regex.ignoreCase);
    assert(!simple2.regex.global);
    assert(!simple2.regex.dotAll);

    const item3 = {
      regex: '/helloWorld'
    };

    const simple3 = BindUtil.bindSchema(RegexSimple, item3);

    assert(simple3.regex instanceof RegExp);
    assert(simple3.regex.source === '\\/helloWorld');
    assert(!simple3.regex.ignoreCase);
    assert(!simple3.regex.global);
    assert(!simple3.regex.dotAll);
  }

  @Test()
  async validateNullOrUndefined() {
    const simple = BindUtil.bindSchema(Address, {
      street1: undefined
    });
    assert('street1' in simple);
    assert(simple.street1 === undefined);

    const simple2 = BindUtil.bindSchema(Address, {
      street1: null
    });
    assert('street1' in simple2);
    assert(simple2.street1 === null);

    const simple3 = Address.fromRaw({
      street1: null as any,
      street2: undefined
    });

    assert('street1' in simple3);
    assert(simple3.street1 === null);

    assert('street2' in simple3);
    assert(simple3.street2 === undefined);
  }
}