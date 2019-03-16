import { Test, Suite } from '@travetto/test';

import { JWTAuthContextSerializer } from '../src/extension/auth-rest.serializer.ext';

@Suite()
class DummySuite {
  @Test({ skip: true })
  dummyTest() {
    console.log(JWTAuthContextSerializer === undefined);
  }
}