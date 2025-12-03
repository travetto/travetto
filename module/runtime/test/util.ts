import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { Util, AsyncQueue, AppError } from '@travetto/runtime';

@Suite()
export class UtilTest {

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));

    assert(Util.uuid().length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }

  @Test()
  async verifyMap() {
    const lines = new AsyncQueue(['aaa', 'bbb']);

    const values: string[] = [];
    let j = 0;
    for await (const el of Util.mapAsyncIterable(lines, (text, i) => `${text} = ${i}`)) {
      values.push(el);
      if ((j += 1) === 2) {
        lines.close();
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }

  @Test()
  async verifySerialize() {
    const payload = {
      err: new AppError('Uh-oh'),
      count: 2000n
    };

    const plain = JSON.parse(Util.serializeToJSON(payload));
    assert('err' in plain);
    assert(typeof plain.err === 'object');
    assert('$' in plain.err);
    assert('stack' in plain.err);
    assert(typeof plain.err.stack === 'string');

    console.error(plain);

    const complex: typeof payload = Util.deserializeFromJson(JSON.stringify(plain));

    assert(complex.err instanceof AppError);
    assert(complex.err.stack === payload.err.stack);
    assert(typeof complex.count === 'bigint');
  }

  @Test('should succeed on first try')
  async acquireWithRetrySucceedFirstTry() {
    let called = 0;
    const result = await Util.acquireWithRetry(
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
    const result = await Util.acquireWithRetry(
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
      await Util.acquireWithRetry(
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
      await Util.acquireWithRetry(
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
    const result = await Util.acquireWithRetry(
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