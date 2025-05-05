import type { Writable } from 'node:stream';

import { stringify } from 'yaml';

import { RuntimeIndex } from '@travetto/runtime';

import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../registry.ts';

/**
 * Xunit consumer, compatible with JUnit formatters
 */
@TestConsumer()
export class XunitEmitter implements TestConsumerShape {
  #tests: string[] = [];
  #suites: string[] = [];
  #stream: Writable;

  constructor(stream: Writable = process.stdout) {
    this.#stream = stream;
  }

  /**
   * Process metadata information (e.g. logs)
   */
  buildMeta(obj: Record<string, unknown>): string {
    if (!obj) {
      return '';
    }

    for (const k of Object.keys(obj)) {
      if (!obj[k]) {
        delete obj[k];
      }
    }
    if (Object.keys(obj).length) {
      let body = stringify(obj);
      body = body.split('\n').map(x => `  ${x}`).join('\n');
      return `<![CDATA[\n${body}\n]]>`;
    } else {
      return '';
    }
  }

  /**
   * Handle each test event
   */
  onEvent(e: TestEvent): void {
    if (e.type === 'test' && e.phase === 'after') {

      const { test } = e;

      let name = `${test.methodName}`;
      if (test.description) {
        name += `: ${test.description}`;
      }

      let body = '';

      if (test.error) {
        const assertErr = test.assertions.find(x => !!x.error)!;
        body = `<failure type="${assertErr.text}" message="${encodeURIComponent(assertErr.message!)}"><![CDATA[${assertErr.error!.stack}]]></failure>`;
      }

      const groupedByLevel: Record<string, string[]> = {};
      for (const log of test.output) {
        (groupedByLevel[log.level] ??= []).push(log.message);
      }

      this.#tests.push(`
    <testcase
      name="${name}"
      time="${test.duration}"
      classname="${test.classId}"
    >
      ${body}
      <system-out>${this.buildMeta({ log: groupedByLevel.log, info: groupedByLevel.info, debug: groupedByLevel.debug })}</system-out>
      <system-err>${this.buildMeta({ error: groupedByLevel.error, warn: groupedByLevel.warn })}</system-err>
    </testcase>`
      );
    } else if (e.type === 'suite' && e.phase === 'after') {
      const { suite } = e;
      const testBodies = this.#tests.slice(0);
      this.#tests = [];

      const out = `
  <testsuite
    name="${suite.classId}"
    time="${suite.duration}"
    tests="${suite.total}"
    failures="${suite.failed}"
    errors="${suite.failed}"
    skipped="${suite.skipped}"
    file="${RuntimeIndex.getFromImport(suite.import)!.sourceFile}"
  >
      ${testBodies.join('\n')}
      </testsuite>
`;
      this.#suites.push(out);
    }
  }

  /**
   * Summarize all results
   */
  onSummary(summary: SuitesSummary): void {
    this.#stream.write(`
<?xml version="1.0" encoding="UTF-8"?>
<testsuites
  name="${summary.suites.length ? RuntimeIndex.getFromImport(summary.suites[0].import)?.sourceFile : 'nameless'}"
  time="${summary.duration}"
  tests="${summary.total}"
  failures="${summary.failed}"
  errors="${summary.failed}"
>
 ${this.#suites.join('\n')}
</testsuites>
`);
  }
}