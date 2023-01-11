import assert from 'assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { RootIndex } from '@travetto/manifest';

import { ExecUtil } from '../src/exec';


@Suite()
export class ExecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: RootIndex.mainModule.output
    });
    const result = await proc.result;
    assert(result.stdout.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: RootIndex.mainModule.output
    });
    const result = await proc.result.catchAsResult!();
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = ExecUtil.fork((await this.fixture.describe('echo.js')).path);
    proc.process.stdin?.write('Hello Worldy');
    proc.process.stdin?.end();
    const result = await proc.result;
    assert(result.stdout === 'Hello Worldy');
  }
}