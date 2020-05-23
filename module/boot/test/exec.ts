import * as fs from 'fs';
import * as assert from 'assert';
import * as path from 'path';

import { Test, Suite } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { FsUtil, ExecUtil, StreamUtil } from '../src';

@Suite()
export class ExecUtilTest {

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: __dirname
    });
    const result = await proc.result;
    assert(result.stdout.includes(path.basename(__filename.replace('.js', '.ts'))));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: __dirname
    });
    const result = await proc.result.catch(err => err.meta);
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = ExecUtil.fork(await ResourceManager.toAbsolutePath('test.js'));
    const result = await proc.result;
    assert(result.stdout === 'Hello World\n');
  }

  @Test()
  execSync() {
    const output = ExecUtil.execSync(`${process.argv0} ${ResourceManager.toAbsolutePathSync('test.js')}`);
    assert(output === 'Hello World');
  }

  @Test()
  async pipe() {
    const echo = await ResourceManager.toAbsolutePath('echo.js');
    const proc = ExecUtil.fork(echo, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const returnedStream = await ExecUtil.pipe(proc, fs.createReadStream(__filename.replace('.js', '.ts')));
    const result = (await StreamUtil.toBuffer(returnedStream)).toString('utf8');
    assert(result.includes('ExecUtil.fork(echo)'));
  }
}