import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { AuthVerifyInterceptor } from '../src/interceptors/verify.ts';

const base = { matcher: (key: Set<string>) => { throw new Error('Function not implemented.'); } } as const;

@Suite()
class VerifierSuite {
  @Test()
  async testPermissions() {
    const interceptor = new AuthVerifyInterceptor();

    let cfg = interceptor.finalizeConfig({ ...base, permissions: ['!c|d', 'a|b'] });

    assert(cfg.matcher(new Set(['a', 'b'])) === true);
    assert(cfg.matcher(new Set(['a', 'b', 'c', 'd'])) === false);

    cfg = interceptor.finalizeConfig({ ...base, permissions: ['!c', '!d', 'a', 'b'] });
    assert(cfg.matcher(new Set(['a'])) === true);
    assert(cfg.matcher(new Set(['b'])) === true);
    assert(cfg.matcher(new Set(['a', 'b', 'c'])) === false);

    cfg = interceptor.finalizeConfig({ ...base, permissions: ['!c', '!d'] });
    assert(cfg.matcher(new Set(['a'])) === true);
    assert(cfg.matcher(new Set([])) === true);
  }

}