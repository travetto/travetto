import assert from 'node:assert';

import { CommonRegex } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

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

  @Test()
  uuid() {
    assert(CommonRegex.uuid.test('550e8400e29b41d4a716446655440000'));
    assert(CommonRegex.uuid.test('550E8400E29B41D4A716446655440000'));

    assert(!CommonRegex.uuid.test('550e8400-e29b-41d4-a716-446655440000'), 'Should not allow hyphens');
    assert(!CommonRegex.uuid.test('550e8400-e29b'));
    assert(!CommonRegex.uuid.test('orange'));
  }
}
