import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { EnvProp } from '@travetto/runtime';

@Suite()
export class EnvTest {

  @Test()
  verifyGet() {
    process.env.name = 'bob';
    process.env.NAME = 'BOB';
    process.env.nAmE = 'bOb';

    assert(new EnvProp('name').value === 'bob');
    assert(new EnvProp('NAME').value === 'BOB');
    assert(new EnvProp('nAmE').value === 'bOb');
    assert(new EnvProp('NaMe').value === undefined);

    assert(new EnvProp('Random').value === undefined);
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
  verifyGetObject() {
    process.env.age = 'name=20,height=30';

    assert.deepStrictEqual(new EnvProp('age').object, { name: '20', height: '30' });
    assert(new EnvProp('age2').object === undefined);

    process.env.missing = '';
    assert.deepStrictEqual(new EnvProp('missing').object, undefined);

    assert.deepStrictEqual(
      new EnvProp('age').export({ name: 20, height: 40 }),
      { age: 'name=20,height=40' }
    );

    assert.deepStrictEqual(
      new EnvProp('age').export(),
      { age: 'name=20,height=30' }
    );

    assert.deepStrictEqual(
      new EnvProp('age').export(undefined),
      { age: '' }
    );
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

}