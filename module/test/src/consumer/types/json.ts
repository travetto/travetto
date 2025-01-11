import type { Writable } from 'node:stream';

import type { TestEvent } from '../../model/event';
import type { SuitesSummary } from '../types';
import { TestConsumer } from '../registry';

/**
 * Returns the entire result set as a single JSON document
 */
@TestConsumer()
export class JSONEmitter {

  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(event: TestEvent): void { }

  onSummary(summary: SuitesSummary): void {
    this.#stream.write(JSON.stringify(summary, undefined, 2));
  }
}