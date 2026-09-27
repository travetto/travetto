import assert from 'node:assert';

import { hasFunction } from '@travetto/runtime';
import { SkipIf, SkipUnless, Suite, Test } from '@travetto/test';

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
  @SkipUnless((instance: SkipMethodSuite) => instance.shouldNotSkip)
  skippedUnlessSync() {
    assert(false);
  }

  @Test()
  @SkipUnless(async (instance: SkipMethodSuite) => instance.shouldNotSkip)
  async skippedUnlessAsync() {
    assert(false);
  }

  @Test()
  @SkipUnless((instance: SkipMethodSuite) => instance.shouldSkip)
  notSkippedUnlessSync() {
    assert(true);
  }

  @Test()
  @SkipUnless(async (instance: SkipMethodSuite) => instance.shouldSkip)
  async notSkippedUnlessAsync() {
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
@SkipUnless(() => false)
class SkippedUnlessSuite {
  @Test()
  testShouldNotRun() {
    assert(false);
  }
}

const hasFeature = hasFunction<{ feature(): void }>('feature');

@Suite()
class SuiteWithFeature {
  feature() {}

  @Test()
  @SkipUnless(hasFeature)
  shouldRun() {
    assert(true);
  }
}

@Suite()
class SuiteWithoutFeature {
  @Test()
  @SkipUnless(hasFeature)
  shouldBeSkipped() {
    assert(false);
  }
}

@Suite()
abstract class AbstractBaseSuite {
  @Test()
  inheritedTest() {
    assert(true);
  }
}

@Suite()
class ConcreteChildSuite extends AbstractBaseSuite {
  @Test()
  childTest() {
    assert(true);
  }
}
