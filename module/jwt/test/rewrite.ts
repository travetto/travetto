import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { JWTUtil } from '../__index__';

@Suite()
export class RewriteSuite {
  @Test()
  async verifyRewrite() {
    const SIGN = { alg: 'HS256', key: 'bob' } as const;

    const token = await JWTUtil.create<{ name: string }>({
      name: 'bob'
    }, SIGN);

    assert(token);

    const decoded = await JWTUtil.verify<{ name: string }>(token, SIGN);
    assert(decoded);
    assert(decoded.name === 'bob');


    const rewritten = await JWTUtil.rewrite<{ name: string }>(token, p => ({
      ...p,
      name: 'roger'
    }), SIGN);

    assert(rewritten);

    const decoded2 = await JWTUtil.verify<{ name: string }>(rewritten, SIGN);
    assert(decoded2);

    assert(decoded2.name === 'roger');
  }
}