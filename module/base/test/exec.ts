import assert from 'assert';
import os from 'os';
import fs from 'fs/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { RootIndex, path } from '@travetto/manifest';

import { ExecUtil } from '../src/exec';
import { StreamUtil } from '../src/stream';


@Suite()
export class ExecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = ExecUtil.spawn('ls', ['-lsa'], {
      cwd: RootIndex.mainModule.outputPath
    });
    const result = await proc.result;
    assert(result.stdout.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = ExecUtil.spawn('ls', ['xxxx'], {
      cwd: RootIndex.mainModule.outputPath,
      catchAsResult: true
    });
    const result = await proc.result;
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = ExecUtil.fork((await this.fixture.describe('echo.js')).path, [], { outputMode: 'binary' });
    proc.process.stdin?.write('Hello Worldy');
    proc.process.stdin?.end();
    const result = await proc.result;
    assert(result.stdout === 'Hello Worldy');
  }

  @Test()
  async pipe() {
    const src = await this.fixture.readStream('/logo.png');

    const state = ExecUtil.spawn('gm', [
      'convert', '-resize', '100x',
      '-auto-orient', '-strip', '-quality', '86',
      '-', '-'
    ]);

    StreamUtil.pipe(src, state.process.stdin!);

    const tempFile = path.resolve(os.tmpdir(), `${Math.random()}.png`);
    await StreamUtil.writeToFile(state.process.stdout!, tempFile);

    const test = await fs.stat(tempFile);
    await fs.unlink(tempFile);
    assert(test.size > 0);
  }
}