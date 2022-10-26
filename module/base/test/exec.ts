import * as assert from 'assert';
import * as path from 'path';

import { Test, Suite } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { ExecUtil } from '..';

@Suite()
export class ExecUtilTest {

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: __source.folder
    });
    const result = await proc.result;
    assert(result.stdout.includes(path.basename(__source.file)));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: __source.folder
    });
    const result = await proc.result.catchAsResult!();
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
}