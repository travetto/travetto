import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { EnvProp } from '../src/env';

@Suite()
export class EnvTest {

  @Test()
  verifyGet() {
    process.env.name = 'bob';
    process.env.NAME = 'BOB';
    process.env.nAmE = 'bOb';

    assert(new EnvProp('name').val === 'bob');
    assert(new EnvProp('NAME').val === 'BOB');
    assert(new EnvProp('nAmE').val === 'bOb');
    assert(new EnvProp('NaMe').val === undefined);

    assert(new EnvProp('nombre').val === undefined);
  }

  @Test()
  verifyGetInt() {
    process.env.age = '20';

    assert(new EnvProp('age').int === 20);
    assert(new EnvProp('age2').int === undefined);

    process.env.age = '-a';
    assert(new EnvProp('age').int === undefined);

    assert(new EnvProp('missing').int === undefined);
    process.env.missing = '';
    assert(new EnvProp('missing').int === undefined);
  }

  @Test()
  verifyGetList() {
    process.env.names = 'a,b,c,d,e';

    assert.deepStrictEqual(new EnvProp('names').list, ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a , b ,  c ,,, d ,,e';

    assert.deepStrictEqual(new EnvProp('names').list, ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '  a  b   c  d e';

    assert.deepStrictEqual(new EnvProp('names').list, ['a', 'b', 'c', 'd', 'e']);

    process.env.names = '';
    assert.deepStrictEqual(new EnvProp('names').list, undefined);

    delete process.env.names;
    assert.deepStrictEqual(new EnvProp('names').list, undefined);
  }

  @Test()
  verifyPresence() {
    process.env.FOUND = 'y';

    assert(new EnvProp('FOUND').isSet);

    delete process.env.FOUND;

    assert(!new EnvProp('FOUND').isSet);
  }

  @Test()
  verifyTrueFalse() {
    for (const val of ['yes', 1, 'TRUE', 'On', true]) {
      process.env.FOUND = `${val}`;

      assert(new EnvProp('FOUND').isTrue);
      assert(!new EnvProp('FOUND').isFalse);
    }

    for (const val of ['no', 0, 'FALSE', 'Off', false]) {
      process.env.found = `${val}`;

      assert(!new EnvProp('found').isTrue);
      assert(new EnvProp('found').isFalse);
    }

    delete process.env.FOUND;
    assert(!new EnvProp('FOUND').isTrue);
    assert(!new EnvProp('FOUND').isFalse);
  }

  @Test()
  verifyIsBoolean() {
    delete process.env.BOOL2;
    assert(new EnvProp('BOOL2').bool === undefined);

    process.env.BOOL2 = '';
    assert(new EnvProp('BOOL2').bool === undefined);

    process.env.BOOL2 = '*';
    assert(new EnvProp('BOOL2').bool === false);

    for (const el of [0, 'FALSE', 'off', false]) {
      process.env.BOOL2 = `${el}`;
      assert(new EnvProp('BOOL2').bool === false);
    }

    for (const el of [1, 'on', true, 'TRUE']) {
      process.env.BOOL2 = `${el}`;
      assert(new EnvProp('BOOL2').bool === true);
    }
  }

  @Test()
  verifyTime() {
    assert(new EnvProp('MAX_AGE').time === undefined);
    process.env.MAX_AGE = '5s';
    assert(new EnvProp('MAX_AGE').time === 5000);
    process.env.MAX_AGE = '5';
    assert(new EnvProp('MAX_AGE').time === 5);
    process.env.MAX_AGE = '5m';
    assert(new EnvProp('MAX_AGE').time === 5 * 1000 * 60);
    process.env.MAX_AGE = '5h';
    assert(new EnvProp('MAX_AGE').time === 5 * 1000 * 60 * 60);
    process.env.MAX_AGE = '5mh';
    assert(new EnvProp('MAX_AGE').time === undefined);
  }

}