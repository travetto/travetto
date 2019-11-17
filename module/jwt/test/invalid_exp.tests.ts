import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('invalid expiration')
class InvalidExpSuite {

  @Test('should fail with string')
  @ShouldThrow(jwt.JWTError)
  async testStringFail() {
    const brokenToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxMjMiLCJmb28iOiJhZGFzIn0.cDa81le-pnwJMcJi3o3PBwB7cTJMiXCkizIhxbXAKRg';
    await jwt.verify(brokenToken, { key: '123' });
  }

  @Test('should fail with 0')
  @ShouldThrow('expired')
  async testExpired() {
    const brokenToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjAsImZvbyI6ImFkYXMifQ.UKxix5T79WwfqAA0fLZr6UrhU-jMES2unwCOFa4grEA';

    await jwt.verify(brokenToken, { key: '123' });
  }

  @Test('should fail with false')
  @ShouldThrow('invalid payload claim')
  async testFalseHuh() {
    const brokenToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOmZhbHNlLCJmb28iOiJhZGFzIn0.iBn33Plwhp-ZFXqppCd8YtED77dwWU0h68QS_nEQL8I';
    await jwt.verify(brokenToken, { key: '123' });
  }

  @Test('should fail with true')
  @ShouldThrow('invalid payload claim')
  async testTrueExpires() {
    const brokenToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOnRydWUsImZvbyI6ImFkYXMifQ.eOWfZCTM5CNYHAKSdFzzk2tDkPQmRT17yqllO-ItIMM';

    await jwt.verify(brokenToken, { key: '123' });
  }

  @Test('should fail with object')
  @ShouldThrow('invalid payload claim')
  async testABC() {
    const brokenToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOnt9LCJmb28iOiJhZGFzIn0.1JjCTsWLJ2DF-CfESjLdLfKutUt3Ji9cC7ESlcoBHSY';
    await jwt.verify(brokenToken, { key: '123' });
  }
}
