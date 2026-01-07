import assert from 'node:assert';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fork, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';

import { path } from '@travetto/manifest';
import { Test, Suite, TestFixtures } from '@travetto/test';
import { ExecUtil, Runtime } from '@travetto/runtime';

@Suite()
export class ExecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const proc = spawn('ls', ['-ls'], {
      cwd: Runtime.workspace.path
    });
    const result = await ExecUtil.getResult(proc);
    assert(result.stdout.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const proc = spawn('ls', ['xxxx'], {
      cwd: Runtime.workspace.path
    });
    const result = await ExecUtil.getResult(proc, { catch: true });
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const proc = fork(await this.fixture.resolve('echo.js'), { stdio: 'pipe' });
    proc.stdin?.write('Hello World');
    proc.stdin?.end();
    const result = await ExecUtil.getResult(proc);
    assert(result.stdout === 'Hello World');
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
  async testImmediateFail() {
    const proc = spawn('npm', ['run', 'Cork'], { cwd: Runtime.workspace.path });
    await timers.setTimeout(600);
    const failure = await ExecUtil.getResult(proc, { catch: true });
    assert(!failure.valid);
  }
}