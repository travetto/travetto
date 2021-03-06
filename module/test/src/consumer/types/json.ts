import { Writable } from 'stream';

import { TestEvent } from '../../model/event';
import { SuitesSummary, TestConsumer } from '../types';
import { Consumable } from '../registry';

/**
 * Returns the entire result set as a single JSON document
 */
@Consumable('json')
export class JSONEmitter implements TestConsumer {

  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent) { }

  onSummary(summary: SuitesSummary) {
    this.#stream.write(JSON.stringify(summary, undefined, 2));
  }
}