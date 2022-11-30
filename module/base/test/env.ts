import assert from 'assert';

import { Test, Suite, AfterEach, BeforeEach } from '@travetto/test';
import { Env } from '../src/env';

@Suite()
export class EnvTest {

  #env?: NodeJS.ProcessEnv;

  @BeforeEach()
  copy() {
    this.#env = process.env;
    process.env = {};
  }

  @AfterEach()
  restore() {
    if (this.#env) {
      process.env = this.#env;
      this.#env = undefined;
    }
  }

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
    assert(isNaN(Env.getInt('age', -1)));
  }

  @Test()
  verifyGetList() {
    process.env.names = 'a,b,c,d,e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a , b ,  c ,,, d ,,e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a  b   c  d e';

    assert.deepStrictEqual(Env.getList('names'), ['a', 'b', 'c', 'd', 'e']);
  }

  @Test()
  verifyGetMap() {
    process.env.mapped = 'a=1,b=2,c=3,d=';
    assert.deepStrictEqual(Env.getEntries('mapped'), [['a', '1'], ['b', '2'], ['c', '3'], ['d', undefined]]);

    process.env.mapped = 'a#1,b#2,c#3,d#';
    assert.deepStrictEqual(Env.getEntries('mapped', '#'), [['a', '1'], ['b', '2'], ['c', '3'], ['d', undefined]]);
  }

  @Test()
  verifyPresence() {
    process.env.found = 'y';

    assert(Env.isSet('FOUND'));

    delete process.env.found;

    assert(!Env.isSet('FOUND'));
  }

  @Test()
  verifyBoolean() {
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
  verifyValueOrFalse() {
    delete process.env.color;
    assert(Env.isValueOrFalse('color', ['red', 'green', 'blue'] as const, 'red') === 'red');
    assert(Env.isValueOrFalse('color', ['red', 'green', 'blue'] as const) === false);
    process.env.color = '0';
    assert(Env.isValueOrFalse('color', ['red', 'green', 'blue'] as const, 'red') === false);
    process.env.color = 'green';
    assert(Env.isValueOrFalse('color', ['red', 'green', 'blue'] as const) === 'green');
    process.env.COLOR2 = 'blue';
    assert(Env.isValueOrFalse('color2', ['red', 'green', 'blue'] as const) === 'blue');
    process.env.COLOR3 = 'gray';
    assert(Env.isValueOrFalse('color3', ['red', 'green', 'blue'] as const) === false);
    assert(Env.isValueOrFalse('color3', ['red', 'green', 'blue'] as const, 'green') === 'green');
  }

  @Test()
  verifyGetBoolean() {
    assert(Env.getBoolean('bool') === undefined);
    process.env.BOOL = '0';
    assert(Env.getBoolean('bool') === false);
    process.env.BOOL = 'off';
    assert(Env.getBoolean('bool') === false);
    process.env.BOOL = '';
    assert(Env.getBoolean('bool') === undefined);
    process.env.BOOL = '*';
    assert(Env.getBoolean('bool') === true);
    process.env.BOOL = '1';
    assert(Env.getBoolean('bool') === true);
  }
}