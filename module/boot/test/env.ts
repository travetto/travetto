import * as assert from 'assert';

import { Test, Suite, AfterEach, BeforeEach } from '@travetto/test';
import { EnvUtil } from '../src';

@Suite()
export class EnvUtilTest {

  private env: any;

  @BeforeEach()
  copy() {
    this.env = { ...process.env };
  }

  @AfterEach()
  restore() {
    process.env = this.env;
    delete this.env;
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
    assert(EnvUtil.getInt('age', -1) === Number.NaN);
  }

  @Test()
  verifyGetList() {
    process.env.names = 'a,b,c,d,e';

    assert(EnvUtil.getList('names') === ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a , b ,  c ,,, d ,,e';

    assert(EnvUtil.getList('names') === ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a  b   c  d e';

    assert(EnvUtil.getList('names') === ['a', 'b', 'c', 'd', 'e']);
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
  verifyTime() {
    assert(EnvUtil.getTime('max_age', 1000) === 1000);
    process.env.MAX_AGE = '5s';
    assert(EnvUtil.getTime('max_age', 1000) === 5000);
    process.env.MAX_AGE = '5';
    assert(EnvUtil.getTime('max_age', 1000) === 5);
    process.env.MAX_AGE = '5m';
    assert(EnvUtil.getTime('max_age', 1000) === 5 * 1000 * 60);
    process.env.MAX_AGE = '5h';
    assert(EnvUtil.getTime('max_age', 1000) === 5 * 1000 * 60 * 60);
    process.env.MAX_AGE = '5mh';
    assert(EnvUtil.getTime('max_age', 1000) === 1000);
  }
}