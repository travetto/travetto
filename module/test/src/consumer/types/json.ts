import type { Writable } from 'node:stream';

import { JSONUtil } from '@travetto/runtime';

import type { SuitesSummary } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

/**
 * Returns the entire result set as a single JSON document
 */
@TestConsumer()
export class JSONEmitter {

  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  onEvent(): void { }

  onSummary(summary: SuitesSummary): void {
    this.#stream.write(JSONUtil.toUTF8Pretty(summary));
  }
}