import type { Writable } from 'node:stream';

import { stringify } from 'yaml';

import { RuntimeIndex } from '@travetto/runtime';

import type { TestEvent } from '../../model/event.ts';
import type { SuitesSummary, TestConsumerShape } from '../types.ts';
import { TestConsumer } from '../decorator.ts';

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
  buildMeta(metadata: Record<string, unknown>): string {
    if (!metadata) {
      return '';
    }

    for (const key of Object.keys(metadata)) {
      if (!metadata[key]) {
        delete metadata[key];
      }
    }
    if (Object.keys(metadata).length) {
      let body = stringify(metadata);
      body = body.split('\n').map(line => `  ${line}`).join('\n');
      return `<![CDATA[\n${body}\n]]>`;
    } else {
      return '';
    }
  }

  /**
   * Handle each test event
   */
  onEvent(event: TestEvent): void {
    if (event.type === 'test' && event.phase === 'after') {

      const { test } = event;

      let name = `${test.methodName}`;
      if (test.description) {
        name += `: ${test.description}`;
      }

      let body = '';

      if (test.error) {
        const assertion = test.assertions.find(item => !!item.error)!;
        const node = test.status === 'failed' ? 'failure' : 'error';
        body = `<${node} type="${assertion.text}" message="${encodeURIComponent(assertion.message!)}"><![CDATA[${assertion.error!.stack}]]></${node}>`;
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
    } else if (event.type === 'suite' && event.phase === 'after') {
      const { suite } = event;
      const testBodies = this.#tests.slice(0);
      this.#tests = [];

      const out = `
  <testsuite
    name="${suite.classId}"
    time="${suite.duration}"
    tests="${suite.total}"
    failures="${suite.failed}"
    errors="${suite.errored}"
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
  errors="${summary.errored}"
  skipped="${summary.skipped}"
>
 ${this.#suites.join('\n')}
</testsuites>
`);
  }
}