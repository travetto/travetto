import assert from 'node:assert';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fork, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';
import path from 'node:path';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { RuntimeIndex } from '@travetto/manifest';

import { RuntimeContext } from '../src/runtime';
import { ExecUtil } from '../src/exec';

@Suite()
export class ExecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = spawn('ls', ['-ls'], {
      cwd: RuntimeIndex.mainModule.outputPath
    });
    const result = await ExecUtil.getResult(proc);
    assert(result.stdout.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = spawn('ls', ['xxxx'], {
      cwd: RuntimeIndex.mainModule.outputPath,
    });
    const result = await ExecUtil.getResult(proc, { catch: true });
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = fork(await this.fixture.resolve('echo.js'), { stdio: 'pipe' });
    proc.stdin?.write('Hello Worldy');
    proc.stdin?.end();
    const result = await ExecUtil.getResult(proc);
    assert(result.stdout === 'Hello Worldy');
  }

  @Test()
  async pipe() {
    const src = await this.fixture.readStream('/logo.png');

    const proc = spawn('gm', [
      'convert', '-resize', '100x',
      '-auto-orient', '-strip', '-quality', '86',
      '-', '-'
    ]);

    const tempFile = path.resolve(os.tmpdir(), `${Math.random()}.png`);

    await Promise.all([
      pipeline(src, proc.stdin!),
      pipeline(proc.stdout!, createWriteStream(tempFile))
    ]);

    const test = await fs.stat(tempFile);
    await fs.unlink(tempFile);
    assert(test.size > 0);
  }

  @Test()
  async testRestart() {
    const file = path.resolve(os.tmpdir(), `${Math.random()}.txt`);
    await fs.writeFile(file, '');

    const result = await ExecUtil.withRestart(() => spawn('/bin/bash', ['-c',
      `(( $(grep -ch '^' '${file}') == 4)) && (exit 0) || (echo 1 >> '${file}'; exit 200)`
    ], { shell: false }));
    assert(result);
    assert(result.code === 0);
    const lines = await (await fs.readFile(file, 'utf8')).split('\n');
    assert(lines.filter(x => !!x).length === 4);
    assert(await fs.stat(file).catch(() => undefined));
  }

  @Test()
  async testImmediateFail() {
    const proc = spawn('npm', ['run', 'zork'], { cwd: RuntimeContext.workspace.path });
    await timers.setTimeout(600);
    const failure = await ExecUtil.getResult(proc, { catch: true });
    assert(!failure.valid);
  }
}