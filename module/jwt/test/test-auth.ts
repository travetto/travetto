import { Test, Suite } from '@travetto/test';

import { JWTAuthContextStore } from '../extension/auth-rest.store';

@Suite()
class DummySuite {
  @Test({ skip: true })
  dummyTest() {
    console.log(JWTAuthContextStore === undefined);
  }
}