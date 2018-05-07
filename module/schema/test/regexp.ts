import { Suite, Test } from '@travetto/test';
import { CommonRegExp } from '../src/service/validator/regexp';
import * as assert from 'assert';

@Suite()
export class RegExpTest {

  @Test()
  telephone() {
    assert(CommonRegExp.telphone.test('555-555-5555'));
    assert(CommonRegExp.telphone.test('5555555555'));

    assert(!CommonRegExp.telphone.test('555-535-522d4'), 'Should not be a valid telephone number');
  }

  @Test()
  email() {
    assert(CommonRegExp.email.test('a@b.com'));
    assert(CommonRegExp.email.test('c@d.com'));

    assert(!CommonRegExp.email.test('d@'));
  }
}