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
    assert(CommonRegex.uuid.test('c7b3d88b77ef4e4b9f29d28b14e9f56a'));
    assert(CommonRegex.uuid.test('C7B3D88B77EF4E4B9F29D28B14E9F56A'));
    assert(CommonRegex.uuid.test('c7b3d88b-77ef-4e4b-9f29-d28b14e9f56a'));
    assert(CommonRegex.uuid.test('C7B3D88B-77EF-4E4B-9F29-D28B14E9F56A'));

    assert(!CommonRegex.uuid.test('not-a-uuid'));
    assert(!CommonRegex.uuid.test('c7b3d88b77ef4e4b9f29d28b14e9f56g'));
    assert(!CommonRegex.uuid.test('12345'));
  }
}
