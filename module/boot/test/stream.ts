import * as assert from 'assert';
import { createReadStream } from 'fs';
import * as os from 'os';

import { ResourceManager } from '@travetto/base';
import { Test, Suite } from '@travetto/test';

import { StreamUtil, ExecUtil } from '../src';

@Suite()
export class StreamUtilTest {

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
    const stream = createReadStream(await ResourceManager.findAbsolute('test.js'));
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

    const stream = createReadStream(await ResourceManager.findAbsolute('test.js'));
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
    const state = ExecUtil.forkMain(await ResourceManager.findAbsolute('long.ts'), ['100000'], { stdio: 'pipe' });
    const stream = await StreamUtil.waitForCompletion(state.process.stdout!, () => state.result);
    const output = (await StreamUtil.toBuffer(stream)).toString('utf8').split(/\n/g);
    assert(output.length >= 100000);
  }
}