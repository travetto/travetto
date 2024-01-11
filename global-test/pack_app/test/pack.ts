import assert from 'node:assert';

import { ExecUtil } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

@Suite()
export class PackAppSuite {

  @Test({ timeout: 60000 })
  async testPack() {
    const tag = `tag-${Math.random()}`.replace(/[0][.]/, '');
    const imageName = 'travetto-test_pack_app';
    const res = ExecUtil.spawn('npx', ['trv', 'pack:docker', '-dt', tag, 'run:double'], {
      cwd: RuntimeIndex.mainModule.sourcePath,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      catchAsResult: true,
      env: { PATH: process.env.PATH }
    });
    const state = await res.result;
    assert(state.valid);

    const res2 = ExecUtil.spawn('docker', ['run', '--rm', `${imageName}:${tag}`, '30'], {
      stdio: 'pipe',
      catchAsResult: true,
    });
    const state2 = await res2.result;
    assert(state2.stderr === '');
    assert(state2.code === 0);

    await ExecUtil.spawn('docker', ['image', 'rm', '--force', `${imageName}:${tag}`]);

    assert(state2.stdout.includes('Result: 60'));
    assert(/Result: 60/.test(state2.stdout));
  }
}