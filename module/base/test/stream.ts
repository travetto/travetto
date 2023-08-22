import assert from 'assert';
import fs from 'fs/promises';
import { createReadStream, appendFileSync } from 'fs';
import os from 'os';
import timers from 'timers/promises';

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
    const temp = `${os.tmpdir()}/${Date.now()}-${Math.random()}.text`;
    await StreamUtil.writeToFile('Hello World', temp);

    const buff = await StreamUtil.toBuffer(createReadStream(temp));
    assert(buff.toString('utf8') === 'Hello World');
  }

  @Test()
  async waitForCompletion() {
    const { path } = await this.fixture.describe('long.js');
    const state = ExecUtil.fork(path, ['20'], { stdio: 'pipe' });
    const stream = await StreamUtil.waitForCompletion(state.process.stdout!, () => state.result);
    const output = (await StreamUtil.toBuffer(stream)).toString('utf8').split(/\n/g);
    assert(output.length >= 20);
  }

  @Test()
  async pipe() {
    const { path: echo } = await this.fixture.describe('echo.js');
    const proc = ExecUtil.fork(echo, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const returnedStream = await StreamUtil.execPipe(proc, createReadStream(
      echo
    ));
    const result = (await StreamUtil.toBuffer(returnedStream)).toString('utf8');
    assert(result.includes('process.stdin'));
  }

  @Test()
  async tailFile() {
    const file = mPath.resolve(os.tmpdir(), `tail-file.${Date.now()}.${Math.random()}`);
    assert(file);
    const received: number[] = [];

    await fs.mkdir(mPath.dirname(file), { recursive: true });
    await fs.appendFile(file, '');

    (async () => {
      for (let i = 0; i < 10; i++) {
        await timers.setTimeout(50);
        appendFileSync(file, `${i}.${'0'.repeat(20)}~~`);
      }

      // Close file
      appendFileSync(file, 'EOF~~');
      await timers.setTimeout(10);
    })();

    let offset = 0;
    outer: for (; ;) {
      for await (const { item, read } of StreamUtil.streamByDelimiter(file, { start: offset, delimiter: '~~' })) {
        if (item === 'EOF') {
          break outer;
        }
        offset = read;
        received.push(parseInt(item, 10));
      }
      await timers.setTimeout(10);
    }
    assert.deepStrictEqual(new Set(received), new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  }
}