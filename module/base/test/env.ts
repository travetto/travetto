import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { Env } from '../src/env';

@Suite()
export class EnvTest {

  @Test()
  verifyGet() {
    process.env.name = 'bob';
    process.env.NAME = 'BOB';
    process.env.nAmE = 'bOb';

    assert(Env.get('name') === 'bob');
    assert(Env.get('NAME') === 'BOB');
    assert(Env.get('nAmE') === 'bOb');
    assert(Env.get('NaMe') === 'BOB');

    assert(Env.get('nombre', 'roberto') === 'roberto');
  }

  @Test()
  verifyGetInt() {
    process.env.age = '20';

    assert(Env.getInt('age', -1) === 20);
    assert(Env.getInt('age2', -1) === -1);

    process.env.age = '-a';
    assert(Env.getInt('age', -1) === -1);

    assert(Env.getInt('missing', -1) === -1);
    assert(Env.getInt('missing') === undefined);
    process.env.missing = '';
    assert(Env.getInt('missing', -1) === -1);
    assert(Env.getInt('missing') === undefined);
  }

  @Test()
  verifyGetList() {
    process.env.names = 'a,b,c,d,e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a , b ,  c ,,, d ,,e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a  b   c  d e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '';
    assert.deepStrictEqual(Env.getList('names'), undefined);

    delete process.env.names;
    assert.deepStrictEqual(Env.getList('names'), undefined);
  }

  @Test()
  verifyPresence() {
    process.env.found = 'y';

    assert(Env.isSet('FOUND'));

    delete process.env.found;

    assert(!Env.isSet('FOUND'));
  }

  @Test()
  verifyTrueFalse() {
    for (const val of ['yes', '1', 'TRUE', 'On']) {
      process.env.found = val;

      assert(Env.isTrue('FOUND'));
      assert(!Env.isFalse('found'));
    }

    for (const val of ['no', '0', 'FALSE', 'Off']) {
      process.env.found = val;
      assert(!Env.isTrue('found'));
      assert(Env.isFalse('FOUND'));
    }

    delete process.env.found;
    assert(!Env.isTrue('FOUND'));
    assert(!Env.isFalse('FOUND'));
  }

  @Test()
  verifyIsBoolean() {
    delete process.env.BOOL;
    assert(Env.getBoolean('bool') === undefined);

    process.env.BOOL = '';
    assert(Env.getBoolean('bool') === undefined);

    process.env.BOOL = '*';
    assert(Env.getBoolean('bool') === false);

    for (const el of ['0', 'off', 'false']) {
      process.env.BOOL = el;
      assert(Env.getBoolean('bool') === false);
      assert(Env.getBoolean('bool', false) === true);
      assert(Env.getBoolean('bool', true) === false);
    }

    for (const el of ['1', 'on', 'true']) {
      process.env.BOOL = el;
      assert(Env.getBoolean('bool') === true);
      assert(Env.getBoolean('bool', false) === false);
      assert(Env.getBoolean('bool', true) === true);
    }
  }

  @Test()
  testAddToList() {
    Env.set({ $_rnd: '0' });
    assert.deepEqual(Env.getList('_rnd'), ['0']);
    Env.set({ $_rnd: '1' });
    assert.deepEqual(Env.getList('_rnd'), ['0', '1']);
    Env.set({ _rnd: '1, 3, 4' });
    Env.set({ $_rnd: '1' });
    assert.deepEqual(Env.getList('_rnd'), ['1', '3', '4']);
    Env.set({ $_rnd: '11' });
    assert.deepEqual(Env.getList('_rnd'), ['1', '3', '4', '11']);
  }
}