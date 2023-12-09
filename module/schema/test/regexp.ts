import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CommonRegExp } from '../src/validate/regexp';

@Suite()
export class RegExpTest {

  @Test()
  telephone() {
    assert(CommonRegExp.telephone.test('555-555-5545'));
    assert(CommonRegExp.telephone.test('5555555555'));

    assert(!CommonRegExp.telephone.test('555-535-522d4'), 'Should not be a valid telephone number');
  }

  @Test()
  email() {
    assert(CommonRegExp.email.test('a@b.com'));
    assert(CommonRegExp.email.test('c@d.com'));

    assert(!CommonRegExp.email.test('d@'));
  }

  @Test()
  simpleName() {
    assert(CommonRegExp.simpleName.test('Billy Bob'));
    assert(CommonRegExp.simpleName.test('Samuel Sammy'));

    assert(!CommonRegExp.simpleName.test('5ro'));
  }
}