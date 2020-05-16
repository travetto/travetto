import { AllSuitesResult } from '../../model/suite';
import { TestEvent } from '../../model/event';
import { TestConsumer } from '../../model/consumer';
import { Consumable } from '../registry';

/**
 * Returns the entire result set as a single JSON document
 */
@Consumable('json')
export class JSONEmitter implements TestConsumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) { }

  onSummary(summary: AllSuitesResult) {
    this.stream.write(JSON.stringify(summary, undefined, 2));
  }
}