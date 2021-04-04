import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { YamlUtil } from '@travetto/yaml';
import { SimpleObject } from '@travetto/base/src/internal/types';

import { ConfigUtil } from '../src/internal/util';

@Suite()
export class UtilTest {

  @Test()
  breakDownKeys() {
    const data = YamlUtil.parse(`
a.b.c:
  - 1
  - 2
  - 3
a.b:
   d: name
a:
  e:
    g: test`) as SimpleObject;

    const broken = ConfigUtil.breakDownKeys(data) as { a: { b: { c: number[], d: string }, e: { g: string } } };
    assert((broken as Record<string, unknown>)['a.b.c'] === undefined);
    assert((broken as Record<string, unknown>)['a.b'] === undefined);

    assert.ok(broken.a);
    assert.ok(broken.a.b);
    assert.ok(broken.a.b.c);
    assert(broken.a.b.c.length === 3);

    assert(broken.a.b.d === 'name');

    assert(broken.a.e.g === 'test');
  }

  @Test()
  bindTo() {
    const res = ConfigUtil.bindTo<{ c?: string }>({ a: { b: { c: '5' } } }, {}, 'a.b');
    assert(res.c === '5');
    process.env.A_B_C = '20';

    const res2 = ConfigUtil.bindTo<{ c?: string }>({ a: { b: { c: '5' } } }, {}, 'a.b');
    assert(res2.c === '20');
  }

  @Test()
  testSecret() {
    const sanitized = ConfigUtil.sanitizeValuesByKey({
      secret: 'custom',
      standard: 'fine',
      key: 'SECRETIVE'
    }, ['secret', 'key']);

    assert(sanitized.secret === '******');
    assert(sanitized.key === '*********');
    assert(sanitized.standard === 'fine');
  }

  @Test()
  testSecretRgex() {
    const sanitized = ConfigUtil.sanitizeValuesByKey({
      secret: 'custom',
      superSecret: 'super',
      big: {
        little: {
          special: '5',
        }
      },
      none: 'none'
    }, ['secret', 'big.*little']);

    assert(sanitized.secret === '******');
    assert(sanitized.superSecret === '*****');
    assert(sanitized.big.little.special === '*');
    assert(sanitized.none === 'none');
  }
}