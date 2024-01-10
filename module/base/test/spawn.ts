import assert from 'node:assert';
import os from 'node:os';
import fs from 'node:fs/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { RuntimeIndex, path } from '@travetto/manifest';

import { Spawn } from '../src/spawn';
import { StreamUtil } from '../src/stream';
import { ExecUtil } from '../__index__';


@Suite()
export class SpawnTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = Spawn.exec('ls', ['-ls'], {
      cwd: RuntimeIndex.mainModule.outputPath
    });
    const result = await proc.result;
    assert(result.stdout?.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = Spawn.exec('ls', ['xxxx'], {
      cwd: RuntimeIndex.mainModule.outputPath,
    });
    const result = await proc.complete;
    assert(result.stderr?.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = Spawn.exec(process.argv0, [await this.fixture.resolve('echo.js')]);
    proc.stdin?.write('Hello Worldy');
    proc.stdin?.end();
    const result = await proc.complete;
    assert(result.stdout === 'Hello Worldy');
  }

  @Test()
  async pipe() {
    const src = await this.fixture.readStream('/logo.png');

    const state = Spawn.exec('gm', [
      'convert', '-resize', '100x',
      '-auto-orient', '-strip', '-quality', '86',
      '-', '-'
    ], { stdio: 'pipe' });

    StreamUtil.pipe(src, state.stdin!);

    const tempFile = path.resolve(os.tmpdir(), `${Math.random()}.png`);
    await StreamUtil.writeToFile(state.stdout!.stream!, tempFile);

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