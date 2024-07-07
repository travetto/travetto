import crypto from 'node:crypto';
import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { WorkQueue } from '@travetto/worker';

import { Util } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));

    assert(Util.uuid().length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }

  @Test()
  async testHash() {
    const allHashes = ' '.repeat(1000).split('').map((x, i) => Util.naiveHash(' '.repeat(i + 2)));
    const hashForSpace = Util.naiveHash(' ');
    assert(!allHashes.includes(hashForSpace));
  }

  @Test()
  staticUuidVerify() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(Util.shortHash('roger') === key.substring(0, 32));
    assert(Util.fullHash('roger', 64) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(Util.fullHash('', 20) === unKey.substring(0, 20));

    assert(Util.fullHash('', 20) !== key.substring(0, 20));
  }

  @Test()
  async verifyMap() {
    const lines = new WorkQueue(['aaa', 'bbb']);

    const values: string[] = [];
    let j = 0;
    for await (const el of Util.mapAsyncItr(lines, (text, i) => `${text} = ${i}`)) {
      values.push(el);
      if ((j += 1) === 2) {
        lines.close();
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }

  @Test()
  async fetchBytes() {
    const data = await Util.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(data.length === 100000);

    const data2 = await Util.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(data2.length === 100001);

    const full = await Util.fetchBytes('https://travetto.dev/assets/landing/bg.jpg');
    assert(full.length === 215532);
  }
}