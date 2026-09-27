import assert from 'node:assert';

import { hasFunction } from '@travetto/runtime';
import { SkipIf, SkipIfNot, Suite, Test } from '@travetto/test';

@Suite()
class SkipMethodSuite {
  shouldSkip = true;
  shouldNotSkip = false;

  @Test()
  @SkipIf((instance: SkipMethodSuite) => instance.shouldSkip)
  skippedSync() {
    assert(false);
  }

  @Test()
  @SkipIf(async (instance: SkipMethodSuite) => instance.shouldSkip)
  async skippedAsync() {
    assert(false);
  }

  @Test()
  @SkipIf((instance: SkipMethodSuite) => instance.shouldNotSkip)
  notSkippedSync() {
    assert(true);
  }

  @Test()
  @SkipIf(async (instance: SkipMethodSuite) => instance.shouldNotSkip)
  async notSkippedAsync() {
    assert(true);
  }

  @Test()
  @SkipIfNot((instance: SkipMethodSuite) => instance.shouldNotSkip)
  skippedNotSync() {
    assert(false);
  }

  @Test()
  @SkipIfNot(async (instance: SkipMethodSuite) => instance.shouldNotSkip)
  async skippedNotAsync() {
    assert(false);
  }

  @Test()
  @SkipIfNot((instance: SkipMethodSuite) => instance.shouldSkip)
  notSkippedNotSync() {
    assert(true);
  }

  @Test()
  @SkipIfNot(async (instance: SkipMethodSuite) => instance.shouldSkip)
  async notSkippedNotAsync() {
    assert(true);
  }
}

@Suite()
@SkipIf(() => true)
class SkippedSuite {
  @Test()
  testShouldNotRun() {
    assert(false);
  }
}

@Suite()
@SkipIfNot(() => false)
class SkippedNotSuite {
  @Test()
  testShouldNotRun() {
    assert(false);
  }
}

class MockServiceWithFeature {
  feature() {}
}

class MockServiceWithoutFeature {}

const hasFeature = hasFunction<{ feature(): void }>('feature');

@Suite()
class ServiceClassSuiteWithFeature {
  serviceClass = MockServiceWithFeature;

  @Test()
  @SkipIfNot(hasFeature)
  shouldRun() {
    assert(true);
  }
}

@Suite()
class ServiceClassSuiteWithoutFeature {
  serviceClass = MockServiceWithoutFeature;

  @Test()
  @SkipIfNot(hasFeature)
  shouldBeSkipped() {
    assert(false);
  }
}
