import * as assert from 'assert';

import { Test, Suite, AfterEach, BeforeEach } from '@travetto/test';
import { EnvUtil } from '..';

@Suite()
export class EnvUtilTest {

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

    assert(EnvUtil.get('name') === 'bob');
    assert(EnvUtil.get('NAME') === 'BOB');
    assert(EnvUtil.get('nAmE') === 'bOb');
    assert(EnvUtil.get('NaMe') === 'BOB');

    assert(EnvUtil.get('nombre', 'roberto') === 'roberto');
  }

  @Test()
  verifyGetInt() {
    process.env.age = '20';

    assert(EnvUtil.getInt('age', -1) === 20);
    assert(EnvUtil.getInt('age2', -1) === -1);

    process.env.age = '-a';
    assert(isNaN(EnvUtil.getInt('age', -1)));
  }

  @Test()
  verifyGetList() {
    process.env.names = 'a,b,c,d,e';

    assert.deepStrictEqual(EnvUtil.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a , b ,  c ,,, d ,,e';

    assert.deepStrictEqual(EnvUtil.getList('names'), ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a  b   c  d e';

    assert.deepStrictEqual(EnvUtil.getList('names'), ['a', 'b', 'c', 'd', 'e']);
  }

  @Test()
  verifyGetMap() {
    process.env.mapped = 'a=1,b=2,c=3,d=';
    assert.deepStrictEqual(EnvUtil.getEntries('mapped'), [['a', '1'], ['b', '2'], ['c', '3'], ['d', undefined]]);

    process.env.mapped = 'a#1,b#2,c#3,d#';
    assert.deepStrictEqual(EnvUtil.getEntries('mapped', '#'), [['a', '1'], ['b', '2'], ['c', '3'], ['d', undefined]]);
  }

  @Test()
  verifyPresence() {
    process.env.found = 'y';

    assert(EnvUtil.isSet('FOUND'));

    delete process.env.found;

    assert(!EnvUtil.isSet('FOUND'));
  }

  @Test()
  verifyBoolean() {
    for (const val of ['yes', '1', 'TRUE', 'On']) {
      process.env.found = val;

      assert(EnvUtil.isTrue('FOUND'));
      assert(!EnvUtil.isFalse('found'));
    }

    for (const val of ['no', '0', 'FALSE', 'Off']) {
      process.env.found = val;
      assert(!EnvUtil.isTrue('found'));
      assert(EnvUtil.isFalse('FOUND'));
    }

    delete process.env.found;
    assert(!EnvUtil.isTrue('FOUND'));
    assert(!EnvUtil.isFalse('FOUND'));
  }

  @Test()
  verifyValueOrFalse() {
    delete process.env.color;
    assert(EnvUtil.isValueOrFalse('color', ['red', 'green', 'blue'] as const, 'red') === 'red');
    assert(EnvUtil.isValueOrFalse('color', ['red', 'green', 'blue'] as const) === false);
    process.env.color = '0';
    assert(EnvUtil.isValueOrFalse('color', ['red', 'green', 'blue'] as const, 'red') === false);
    process.env.color = 'green';
    assert(EnvUtil.isValueOrFalse('color', ['red', 'green', 'blue'] as const) === 'green');
    process.env.COLOR2 = 'blue';
    assert(EnvUtil.isValueOrFalse('color2', ['red', 'green', 'blue'] as const) === 'blue');
    process.env.COLOR3 = 'gray';
    assert(EnvUtil.isValueOrFalse('color3', ['red', 'green', 'blue'] as const) === false);
    assert(EnvUtil.isValueOrFalse('color3', ['red', 'green', 'blue'] as const, 'green') === 'green');
  }

  @Test()
  verifyGetBoolean() {
    assert(EnvUtil.getBoolean('bool') === undefined);
    process.env.BOOL = '0';
    assert(EnvUtil.getBoolean('bool') === false);
    process.env.BOOL = 'off';
    assert(EnvUtil.getBoolean('bool') === false);
    process.env.BOOL = '';
    assert(EnvUtil.getBoolean('bool') === undefined);
    process.env.BOOL = '*';
    assert(EnvUtil.getBoolean('bool') === true);
    process.env.BOOL = '1';
    assert(EnvUtil.getBoolean('bool') === true);
  }
}