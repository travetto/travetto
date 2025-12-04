import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CommonRegex } from '@travetto/schema';

@Suite()
export class RegExpTest {

  @Test()
  telephone() {
    assert(CommonRegex.telephone.test('555-555-5545'));
    assert(CommonRegex.telephone.test('5555555555'));

    assert(!CommonRegex.telephone.test('555-535-522d4'), 'Should not be a valid telephone number');
  }

  @Test()
  email() {
    assert(CommonRegex.email.test('a@b.com'));
    assert(CommonRegex.email.test('c@d.com'));

    assert(!CommonRegex.email.test('d@'));
  }

  @Test()
  simpleName() {
    assert(CommonRegex.simpleName.test('Billy Bob'));
    assert(CommonRegex.simpleName.test('Samuel Sammy'));

    assert(!CommonRegex.simpleName.test('5ro'));
  }
}