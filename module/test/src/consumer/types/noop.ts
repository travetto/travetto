import { TestConsumer } from '../decorator.ts';
import type { TestConsumerShape } from '../types.ts';

/**
 * Does nothing consumer
 */
@TestConsumer()
export class NoopConsumer implements TestConsumerShape {
  onEvent(): void {}
}
