import * as yaml from 'js-yaml';
import { Util } from './util';
import { TestEvent } from './model/event';

export class TapEmitter {
  count = 0;
  fail = 0;
  ok = 0;
  duration = 0;
  skipped = 0;
  errors: Error[] = [];
  suiteDuration = 0;

  constructor(public stream = process.stdout) { }

  log(message: string) {
    this.stream.write(`${message}\n`);
  }

  logMeta(obj: any) {
    let body = yaml.safeDump(obj, { indent: 2 });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${body}\n...`);
  }

  onEvent(pkg: string, e: TestEvent) {
    if (e.type === 'suite' && e.phase === 'after') {
      this.suiteDuration += e['suite'].duration;
    } else if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      let header = `${pkg}#${test.classId} - ${test.methodName}`;
      if (test.description) {
        header += `: ${test.description}`;
      }
      this.log(`# ${header}`);

      if (test.assertions.length) {
        let subCount = 0;
        for (const a of test.assertions) {
          const text = a.message ? `${a.text} (${a.message})` : a.text;
          let subMessage = `ok ${++subCount} - ${text} ${a.file}:${a.line}`;
          if (a.error) {
            subMessage = `not ${subMessage}`;
          }
          this.log(`    ${subMessage}`);
        }
        this.log(`    1..${subCount}`);
      }

      let status = `ok ${++this.count} `;
      switch (test.status) {
        case 'skipped': {
          status += ' # SKIP';
          this.skipped++;
          break;
        }
        case 'failed': {
          status = `not ${status}`;
          this.fail++;
          break;
        }
        default: this.ok++;
      }
      status += header;

      status += `# (Time: ${test.duration})`;

      this.duration += test.duration;

      this.log(status);

      if (test.status === 'failed') {
        if (test.error && test.error.stack && !test.error.stack.includes('AssertionError')) {
          this.logMeta({ error: Util.deserializeError(test.error)!.stack });
        }
        if (test.error) {
          this.errors.push(test.error);
        }
      }
      if (test.output) {
        for (const key of ['log', 'info', 'error', 'debug', 'warn']) {
          if (test.output[key]) {
            this.logMeta({
              [key]: test.output[key]
            });
          }
        }
      }
    }
  }

  summarize() {
    this.log(`1..${this.count}`);

    if (this.errors.length) {
      this.log('---\n');
      for (const err of this.errors) {
        this.log(err.stack || `${err}`);
      }
    }

    this.log(`Results ${this.ok}/${this.count}, failed ${this.fail}, skipped ${this.skipped} # (Test Time: ${this.duration}, Suite Time: ${this.suiteDuration})`);
  }
}