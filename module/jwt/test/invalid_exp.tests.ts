import * as assert from 'assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';
import { JWTError } from '../src/common';

@Suite('invalid expiration')
class InvalidExpSuite {

  @Test('should fail with string')
  @ShouldThrow(JWTError)
  async testStringFail() {
    const broken_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxMjMiLCJmb28iOiJhZGFzIn0.cDa81le-pnwJMcJi3o3PBwB7cTJMiXCkizIhxbXAKRg';
    await jwt.verify(broken_token, { key: '123' });
  }

  @Test('should fail with 0')
  @ShouldThrow('expired')
  async testExpired() {
    const broken_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjAsImZvbyI6ImFkYXMifQ.UKxix5T79WwfqAA0fLZr6UrhU-jMES2unwCOFa4grEA';

    await jwt.verify(broken_token, { key: '123' });
  }

  @Test('should fail with false')
  @ShouldThrow('invalid payload claim')
  async testFalseHuh() {
    const broken_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOmZhbHNlLCJmb28iOiJhZGFzIn0.iBn33Plwhp-ZFXqppCd8YtED77dwWU0h68QS_nEQL8I';
    await jwt.verify(broken_token, { key: '123' });
  }

  @Test('should fail with true')
  @ShouldThrow('invalid payload claim')
  async testTrueExpires() {
    const broken_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOnRydWUsImZvbyI6ImFkYXMifQ.eOWfZCTM5CNYHAKSdFzzk2tDkPQmRT17yqllO-ItIMM';

    await jwt.verify(broken_token, { key: '123' });
  }

  @Test('should fail with object')
  @ShouldThrow('invalid payload claim')
  async testABC() {
    const broken_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOnt9LCJmb28iOiJhZGFzIn0.1JjCTsWLJ2DF-CfESjLdLfKutUt3Ji9cC7ESlcoBHSY';
    await jwt.verify(broken_token, { key: '123' });
  }
}
