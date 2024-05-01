import assert from 'node:assert';
import { createReadStream } from 'node:fs';
import os from 'node:os';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { path as mPath } from '@travetto/manifest';

import { StreamUtil } from '../src/stream';

@Suite()
export class StreamUtilTest {

  fixture = new TestFixtures();

  @Test()
  async bufferToStream() {
    const buffer = Buffer.from('hello world');
    assert(buffer instanceof Buffer);
    const stream = await StreamUtil.bufferToStream(buffer);
    assert('pipe' in stream);
    const text = (await StreamUtil.streamToBuffer(stream)).toString('utf8');
    assert(text.length === 11);
    assert(text === 'hello world');
  }

  @Test()
  async streamToBuffer() {
    const stream = await this.fixture.readStream('/test.js');
    const text = (await StreamUtil.streamToBuffer(stream)).toString('utf8');
    assert(text.length > 1);
    assert(text.includes('Hello World'));
  }

  @Test()
  async toBuffer() {
    const b64 = Buffer.from('Hello World').toString('base64');
    assert(/=$/.test(b64));
    const buffer = await StreamUtil.toBuffer(b64);
    assert(buffer.toString('utf8') === 'Hello World');

    const unit8 = new Uint8Array([
      97, 98, 99, 100, 101
    ]);

    assert((await StreamUtil.toBuffer(unit8)).toString('utf8') === 'abcde');

    const stream = await this.fixture.readStream('/test.js');
    assert((await StreamUtil.toBuffer(stream)).length > 10);
  }

  @Test()
  async toStream() {
    const stream = await StreamUtil.toStream('Hello World');
    const text = (await StreamUtil.streamToBuffer(stream)).toString('utf8');
    assert(text === 'Hello World');
  }

  @Test()
  async writeToFile() {
    const temp = mPath.resolve(os.tmpdir(), `${Date.now()}-${Math.random()}.text`);
    await StreamUtil.writeToFile('Hello World', temp);

    const buff = await StreamUtil.toBuffer(createReadStream(temp));
    assert(buff.toString('utf8') === 'Hello World');
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