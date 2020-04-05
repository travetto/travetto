import { YamlUtil } from '@travetto/yaml';

import { AllSuitesResult } from '../../model/suite';
import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { Consumable } from '../registry';

@Consumable('xunit')
export class XunitEmitter implements Consumer {
  private tests: string[] = [];
  private suites: string[] = [];

  constructor(
    private stream: NodeJS.WriteStream = process.stdout
  ) { }

  buildMeta(obj: any) {
    if (!obj) {
      return '';
    }

    for (const k of Object.keys(obj)) {
      if (!obj[k]) {
        delete obj[k];
      }
    }
    if (Object.keys(obj).length) {
      let body = YamlUtil.serialize(obj);
      body = body.split('\n').map(x => `  ${x}`).join('\n');
      return `<![CDATA[\n${body}\n]]>`;
    } else {
      return '';
    }
  }

  onEvent(e: TestEvent) {
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

      this.tests.push(`
    <testcase
      name="${name}"
      time="${test.duration}"
      classname="${test.className}"
    >
      ${body}
      <system-out>${this.buildMeta({ log: test.output.log, info: test.output.info, debug: test.output.debug })}</system-out>
      <system-err>${this.buildMeta({ error: test.output.error, warn: test.output.warn })}</system-err>
    </testcase>`
      );
    } else if (e.type === 'suite' && e.phase === 'after') {
      const { suite } = e;
      const testBodies = this.tests.slice(0);
      this.tests = [];

      const out = `
  <testsuite
    name="${suite.className}"
    time="${suite.duration}"
    tests="${suite.total}"
    failures="${suite.fail}"
    errors="${suite.fail}"
    skipped="${suite.skip}"
    file="${suite.file}"
  >
      ${testBodies.join('\n')}
      </testsuite>
`;
      this.suites.push(out);
    }
  }

  onSummary(summary: AllSuitesResult) {
    this.stream.write(`
<?xml version="1.0" encoding="UTF-8"?>
<testsuites
  name="${summary.suites.length ? summary.suites[0].file : 'nameless'}"
  time="${summary.duration}"
  tests="${summary.total}"
  failures="${summary.fail}"
  errors="${summary.fail}"
>
 ${this.suites.join('\n')}
</testsuites>
`);
  }
}