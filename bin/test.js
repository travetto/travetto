#!/usr/bin/env node

const readline = require('readline');
const yaml = require('js-yaml');
const cp = require('child_process');

/**
 * 
 * @param {Error} e 
 */
function deserializeError(e) {
  if (e && e.$) {
    const err = new Error();
    for (const k of Object.keys(e)) {
      err[k] = e[k];
    }
    err.message = e.message;
    err.stack = e.stack;
    err.name = e.name;
    return err;
  } else if (e) {
    return e;
  }
}

/**
 * An assertion fo testing  
 * @typedef {Object} Assertion
 * @property {String} message
 * @property {String} text
 * @property {String} file
 * @property {Number} line
 */

/**
 * A test result
 * @typedef {Object} Test
 * @property {String} className
 * @property {String} methodName
 * @property {String} [description]
 * @property {String} status
 * @property {Error} [error]
 * @property {Assertion[]} assertions
 */

/**
 * A test event
 * @typedef {Object} TestEvent
 * @property {String} phase
 * @property {String} type
 * @property {Test} test
 */

class TapEmitter {
  constructor(stream = process.stdout) {
    this.stream = stream;
    this.count = 0;
    this.fail = 0;
    this.ok = 0;
    this.skipped = 0;
    this.errors = [];
  }

  /**
   * 
   * @param {String} message 
   */
  log(message) {
    this.stream.write(`${message}\n`);
  }

  /**
   * 
   * @param {*} obj 
   */
  logMeta(obj) {
    let body = yaml.safeDump(obj, { indent: 2 });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${body}\n...`);
  }

  /**
   * 
   * @param {String} pkg
   * @param {TestEvent} e 
   */
  onEvent(pkg, e) {
    if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      let header = `${pkg}#${test.className} - ${test.methodName}`;
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
      if (test.status === 'skip') {
        status += ' # SKIP';
        this.skipped++;
      } else if (test.status === 'fail') {
        status = `not ${status}`;
        this.fail++;
      } else {
        this.ok++;
      }
      status += header;

      this.log(status);

      if (test.status === 'fail') {
        if (test.error && test.error.stack && !test.error.stack.includes('AssertionError')) {
          this.logMeta({ error: deserializeError(test.error).stack });
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

    this.log(`Results ${this.ok}/${this.count}, failed ${this.fail}, skipped ${this.skipped}`);
  }
}

async function test() {

  cp.spawnSync('npx', [
    'lerna', '--no-bail', 'exec', '--parallel', '--',
    'npx', 'travetto', 'clean'
  ]);

  // Rewrite
  const child = cp.spawn('npx', [
    'lerna', '--concurrency', '5', 'exec', '--no-bail', '--stream', '--',
    'npx', 'travetto', 'test', '-f', 'event', '-c', '3'
  ]);

  const emitter = new TapEmitter();

  const rl = readline.createInterface({
    input: child.stdout,
    output: process.stdout,
    terminal: false
  });

  rl
    .on('line', function(line) {
      const space = line.indexOf(' ');
      const body = line.substring(space + 1);
      const name = line.substring(0, space - 1);
      try {
        emitter.onEvent(name, JSON.parse(body));
      } catch (e) {
        console.error(name, body);
        console.error(e);
        process.exit(1);
      }
    })
    .on('close', () => {
      emitter.summarize();
    });
}

test();