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
    const proc = ExecUtil.spawn('ls', ['-ls'], {
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

  @Test()
  async testRestart() {
    const file = path.resolve(os.tmpdir(), `${Math.random()}.txt`);
    await fs.writeFile(file, '');

    const result = await ExecUtil.spawnWithRestart('/bin/bash', ['-c',
      `(( $(grep -ch '^' '${file}') == 4)) && (exit 0) || (echo 1 >> '${file}'; exit 200)`
    ]);
    assert(result);
    assert(result.code === 0);
    const lines = await (await fs.readFile(file, 'utf8')).split('\n');
    assert(lines.filter(x => !!x).length === 4);
    assert(await fs.stat(file).catch(() => undefined));
  }
}