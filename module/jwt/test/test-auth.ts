import { Test, Suite } from '@travetto/test';

import { JWTAuthContextStore } from '../src/extension/auth-rest.store.ext';

@Suite()
class DummySuite {
  @Test({ skip: true })
  dummyTest() {
    console.log(JWTAuthContextStore === undefined);
  }
}