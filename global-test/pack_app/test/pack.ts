import { spawn } from 'node:child_process';
import assert from 'node:assert';

import { ExecUtil, Env } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

@Suite()
export class PackAppSuite {

  @Test({ timeout: 60000 })
  async testPack() {
    const tag = `tag-${Math.random()}`.replace(/[0][.]/, '');
    const imageName = 'travetto-test_pack_app';
    assert(RuntimeIndex.mainModule.sourcePath.endsWith('pack_app'));
    const proc = spawn('npx', ['trv', 'pack:docker', '-dt', tag, 'run:double'], {
      cwd: RuntimeIndex.mainModule.sourcePath,
      shell: false,
      env: { PATH: process.env.PATH, ...Env.TRV_DYNAMIC.export(false) }
    });

    const state = await ExecUtil.getResult(proc, { catch: true });
    assert(state.valid);

    const proc2 = spawn('docker', ['run', '--rm', `${imageName}:${tag}`, '30']);
    const state2 = await ExecUtil.getResult(proc2);
    assert(state2.stderr === '');
    assert(state2.code === 0);

    const proc3 = spawn('docker', ['image', 'rm', '--force', `${imageName}:${tag}`]);
    await ExecUtil.getResult(proc3);

    assert(state2.stdout.includes('Result: 60'));
    assert(/Result: 60/.test(state2.stdout));
  }
}