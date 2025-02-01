import { Test, Suite } from '@travetto/test';

@Suite()
class DummySuite {
  @Test({ skip: true })
  dummyTest() {
    // console.log(JWTAuthContextStore === undefined);
  }
}