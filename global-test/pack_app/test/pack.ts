import { spawn } from 'node:child_process';
import assert from 'node:assert';

import { ExecUtil, Runtime } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

@Suite()
class PackAppSuite {

  @Test({ timeout: 60000 })
  async testPack() {
    const tag = `tag-${Math.random()}`.replace(/[0][.]/, '');
    const imageName = 'travetto-test_pack_app';
    assert(Runtime.mainSourcePath.endsWith('pack_app'));
    const process = ExecUtil.spawnPackageCommand('trv', ['pack:docker', '-dt', tag, 'run:double'], { cwd: Runtime.mainSourcePath });

    const state = await ExecUtil.getResult(process, { catch: true });
    console.log(state.stderr);
    assert(state.valid);

    const process2 = spawn('docker', ['run', '--rm', `${imageName}:${tag}`, '30']);
    const state2 = await ExecUtil.getResult(process2);
    assert(state2.stderr === '');
    assert(state2.code === 0);

    const process3 = spawn('docker', ['image', 'rm', '--force', `${imageName}:${tag}`]);
    await ExecUtil.getResult(process3);

    assert(state2.stdout.includes('Result: 60'));
    assert(/Result: 60/.test(state2.stdout));
  }
}