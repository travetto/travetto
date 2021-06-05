import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { YamlUtil } from '@travetto/yaml';
import { BindUtil } from '@travetto/schema';

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
    g: test`) as Record<string, unknown>;

    const broken = BindUtil.expandPaths(data) as { a: { b: { c: number[], d: string }, e: { g: string } } };
    assert((broken as Record<string, unknown>)['a.b.c'] === undefined);
    assert((broken as Record<string, unknown>)['a.b'] === undefined);

    console.log(broken);

    assert.ok(broken.a);
    assert.ok(broken.a.b);
    assert.ok(broken.a.b.c);
    assert(broken.a.b.c.length === 3);

    assert(broken.a.b.d === 'name');

    assert(broken.a.e.g === 'test');
  }

  @Test()
  testSecret() {
    const sanitized = ConfigUtil.sanitizeValuesByKey({
      secret: 'custom',
      standard: 'fine',
      key: 'SECRETIVE'
    }, ['secret', 'key']);

    assert(sanitized.secret === '**********');
    assert(sanitized.key === '**********');
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

    assert(sanitized.secret === '**********');
    assert(sanitized.superSecret === '**********');
    assert(sanitized.big.little.special === '**********');
    assert(sanitized.none === 'none');
  }
}