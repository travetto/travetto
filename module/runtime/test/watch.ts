import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';
import { WatchUtil } from '../src/watch.ts';

@Suite()
class WatchSuite {

  @Test('should succeed on first try')
  async acquireWithRetrySucceedFirstTry() {
    let called = 0;
    const result = await WatchUtil.acquireWithRetry(
      async () => {
        called++;
        return 42;
      },
      () => undefined,
      3
    );
    assert(result === 42);
    assert(called === 1);
  }

  @Test('should retry on failure and succeed')
  async acquireWithRetryRetryAndSucceed() {
    let called = 0;
    const result = await WatchUtil.acquireWithRetry(
      async () => {
        called++;
        if (called < 2) {
          throw new Error('fail');
        }
        return 'ok';
      },
      () => true,
      3
    );
    assert(result === 'ok');
    assert(called === 2);
  }

  @Test('should stop retrying if prepareRetry returns false')
  async acquireWithRetryStopOnPrepareRetryFalse() {
    let called = 0;
    await assert.rejects(async () => {
      await WatchUtil.acquireWithRetry(
        async () => {
          called++;
          throw new Error('fail');
        },
        () => false,
        3
      );
    }, /fail/);
    assert(called === 1);
  }

  @Test('should throw after maxTries')
  async acquireWithRetryThrowAfterMaxTries() {
    let called = 0;
    await assert.rejects(async () => {
      await WatchUtil.acquireWithRetry(
        async () => {
          called++;
          throw new Error('fail');
        },
        () => true,
        2
      );
    }, /fail/);
    assert(called === 2);
  }

  @Test('should handle sync operations')
  async acquireWithRetryHandleSync() {
    let called = 0;
    const result = await WatchUtil.acquireWithRetry(
      () => {
        called++;
        if (called < 2) {
          throw new Error('fail');
        }
        return 'done';
      },
      () => true,
      3
    );
    assert(result === 'done');
    assert(called === 2);
  }
}