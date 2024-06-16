import assert from 'node:assert';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { StreamUtil } from '../src/stream';

@Suite()
export class StreamUtilTest {

  fixture = new TestFixtures();

  @Test()
  async toStream() {
    const stream = await StreamUtil.toStream('Hello World');
    const text = (await toBuffer(stream)).toString('utf8');
    assert(text === 'Hello World');
  }

  @Test()
  async readChunk() {
    const yml = await this.fixture.resolve('/asset.yml');
    const chunk = await StreamUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async fetchBytes() {
    const data = await StreamUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(data.length === 100000);

    const data2 = await StreamUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(data2.length === 100001);

    const full = await StreamUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg');
    assert(full.length === 215532);
  }
}