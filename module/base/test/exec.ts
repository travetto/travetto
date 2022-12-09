import assert from 'assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { path } from '@travetto/manifest';

import { ExecUtil } from '../src/exec';


@Suite()
export class ExecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: path.dirname(__output)
    });
    const result = await proc.result;
    assert(result.stdout.includes(path.basename(__output)));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: path.dirname(__output)
    });
    const result = await proc.result.catchAsResult!();
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = ExecUtil.fork((await this.fixture.describe('test.js')).path);
    const result = await proc.result;
    assert(result.stdout === 'Hello World\n');
  }
}