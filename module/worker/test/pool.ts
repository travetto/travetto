import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { WorkPool, WorkPoolResultError } from '@travetto/worker';

@Suite()
export class WorkPoolTest {
  @Test()
  async testSimpleRun() {
    const inputs = [1, 2, 3, 4, 5];
    const completedInputs: number[] = [];
    let completeCount = 0;

    await WorkPool.run(
      async input => {
        return input * 2;
      },
      inputs,
      {
        max: 1,
        total: 5,
        onComplete: ({ output, input, success, progress }) => {
          completedInputs.push(input);
          completeCount++;
          assert.equal(output, input * 2);
          assert.equal(success, true);
          assert.equal(progress.completed, completeCount);
          assert.equal(progress.total, 5);
          assert.equal(progress.failed, 0);
        }
      }
    );

    assert.equal(completedInputs.length, 5);
    completedInputs.sort((a, b) => a - b);
    assert.deepEqual(completedInputs, [1, 2, 3, 4, 5]);
  }

  @Test()
  async testIsSuccess() {
    const inputs = [1, 2, 3, 4, 5];
    let failedCount = 0;

    await WorkPool.run(async input => input, inputs, {
      max: 2,
      isSuccess: output => output % 2 !== 0,
      onComplete: ({ output, success, progress }) => {
        if (!success) {
          failedCount++;
        }
        assert.equal(success, output % 2 !== 0);
        assert.equal(progress.failed, failedCount);
      }
    });

    assert.equal(failedCount, 2);
  }

  @Test()
  async testErrorAccumulation() {
    const inputs = [1, 2, 3];

    await assert.rejects(
      async () => {
        await WorkPool.run(
          async input => {
            if (input === 2 || input === 3) {
              throw new Error(`Error ${input}`);
            }
            return input;
          },
          inputs,
          {
            max: 1
          }
        );
      },
      err => {
        assert(err instanceof WorkPoolResultError);
        assert.equal(err.details.errors.length, 2);
        assert.equal(err.details.errors[0].message, 'Error 2');
        assert.equal(err.details.errors[1].message, 'Error 3');
        return true;
      }
    );
  }

  @Test()
  async testRunStream() {
    const inputs = [10, 20, 30];
    const results: number[] = [];

    const stream = WorkPool.runStream(async input => input + 1, inputs, { max: 2 });

    for await (const event of stream) {
      results.push(event.output);
      assert.equal(event.success, true);
      assert(event.progress.completed >= 1 && event.progress.completed <= 3);
    }

    assert.equal(results.length, 3);
    results.sort((a, b) => a - b);
    assert.deepEqual(results, [11, 21, 31]);
  }
}
