import type { Writable } from 'node:stream';

import type { TestEvent } from '../../model/event';
import type { SuitesSummary, TestConsumer } from '../types';
import { RegisterTestConsumer } from '../registry';

/**
 * Returns the entire result set as a single JSON document
 */
@RegisterTestConsumer()
export class JSONEmitter implements TestConsumer {

  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent): void { }

  onSummary(summary: SuitesSummary): void {
    this.#stream.write(JSON.stringify(summary, undefined, 2));
  }
}