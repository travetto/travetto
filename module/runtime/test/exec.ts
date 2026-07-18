import assert from 'node:assert';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fork, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';
import path from 'node:path';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { ExecUtil, Runtime } from '@travetto/runtime';

@Suite()
export class ExecUtilTest {
  fixture = new TestFixtures();

  @Test()
  async spawn() {
    const process = spawn('ls', ['-ls'], {
      cwd: Runtime.workspace.path
    });
    const result = await ExecUtil.getResult(process);
    assert(result.stdout.includes('package.json'));
    assert(result.code === 0);
    assert(result.valid);
  }

  @Test()
  async spawnBad() {
    const process = spawn('ls', ['xxxx'], {
      cwd: Runtime.workspace.path
    });
    const result = await ExecUtil.getResult(process, { catch: true });
    assert(result.stderr.includes('xxxx'));
    assert(result.code > 0);
    assert(!result.valid);
  }

  @Test()
  async fork() {
    const process = fork(await this.fixture.resolve('echo.js'), { stdio: 'pipe' });
    process.stdin?.write('Hello World');
    process.stdin?.end();
    const result = await ExecUtil.getResult(process);
    assert(result.stdout === 'Hello World');
  }

  @Test()
  async pipe() {
    const src = await this.fixture.readBinaryStream('/logo.png');

    const process = spawn('gm', ['convert', '-resize', '100x', '-auto-orient', '-strip', '-quality', '86', '-', '-']);

    const tempFile = path.resolve(os.tmpdir(), `${Math.random()}.png`);

    await Promise.all([pipeline(src, process.stdin!), pipeline(process.stdout!, createWriteStream(tempFile))]);

    const test = await fs.stat(tempFile);
    await fs.unlink(tempFile);
    assert(test.size > 0);
  }

  @Test()
  async testImmediateFail() {
    const process = spawn('npm', ['run', 'Cork'], { cwd: Runtime.workspace.path });
    await timers.setTimeout(600);
    const failure = await ExecUtil.getResult(process, { catch: true });
    assert(!failure.valid);
  }
}
