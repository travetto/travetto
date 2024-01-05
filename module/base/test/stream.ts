import assert from 'node:assert';
import { createReadStream } from 'node:fs';
import os from 'node:os';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { path as mPath } from '@travetto/manifest';

import { ExecUtil } from '../src/exec';
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
  async waitForCompletion() {
    const path = await this.fixture.resolve('long.js');
    const state = ExecUtil.spawn(process.argv0, [path, '20'], { stdio: 'pipe' });
    const stream = await StreamUtil.waitForCompletion(state.process.stdout!, () => state.result);
    const output = (await StreamUtil.toBuffer(stream)).toString('utf8').split(/\n/g);
    assert(output.length >= 20);
  }

  @Test()
  async pipe() {
    const echo = await this.fixture.resolve('echo.js');
    const proc = ExecUtil.spawn(process.argv0, [echo], { stdio: ['pipe', 'pipe', 'pipe'] });
    const returnedStream = await StreamUtil.execPipe(proc, createReadStream(
      echo
    ));
    const result = (await StreamUtil.toBuffer(returnedStream)).toString('utf8');
    assert(result.includes('process.stdin'));
  }
}