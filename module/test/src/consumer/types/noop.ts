import type { TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

/**
 * Does nothing consumer
 */
@TestConsumer()
export class NoopConsumer implements TestConsumerShape {
  onEvent(): void { }
}