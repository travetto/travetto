import { Worker } from '@travetto/worker';

import { TestConsumer } from '../consumer/types';
import { TestExecutor } from '../execute/executor';

/**
 *  Produce a handler for the child worker
 */
export function buildIsolatedTestManager(consumer: TestConsumer) {
  let id = 0;
  return (): Worker<string> => ({
    id: id++,
    active: true,
    async destroy() { },
    async execute(file: string) {
      await TestExecutor.executeIsolated(consumer, file);
    }
  });
}