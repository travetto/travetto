import * as fs from 'fs';
import * as assert from 'assert';
import * as path from 'path';

import { Test, Suite } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { ExecUtil, StreamUtil } from '../src';

@Suite()
export class ExecUtilTest {

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: __dirname
    });
    const result = await proc.result;
    assert(result.stdout.includes(path.basename(__filename.replace(/[.]js$/, '.ts'))));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: __dirname
    });
    const result = await proc.result.catchAsResult();
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = ExecUtil.fork(await ResourceManager.findAbsolute('test.js'));
    const result = await proc.result;
    assert(result.stdout === 'Hello World\n');
  }

  @Test()
  async forkMain() {
    const proc = ExecUtil.forkMain(await ResourceManager.findAbsolute('test.ts'));
    const result = await proc.result;
    assert(result.stdout === 'Hello World\n');
  }

  @Test()
  async worker() {
    const { message } = ExecUtil.workerMain(await ResourceManager.findAbsolute('worker.ts'));
    const result = await message;
    assert(result === { a: 1, b: 2, c: new Set([1, 2, 3]) });
  }

  @Test()
  async execSync() {
    const output = ExecUtil.execSync(`${process.argv0} ${await ResourceManager.findAbsolute('test.js')}`);
    assert(output === 'Hello World');
  }

  @Test()
  async pipe() {
    const echo = await ResourceManager.findAbsolute('echo.ts');
    const proc = ExecUtil.forkMain(echo, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const returnedStream = await ExecUtil.pipe(proc, fs.createReadStream(__filename.replace(/[.]js$/, '.ts')));
    const result = (await StreamUtil.toBuffer(returnedStream)).toString('utf8');
    assert(result.includes('ExecUtil.forkMain(echo'));
  }
}