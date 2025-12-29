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
    const proc = spawn(process.argv0, [Runtime.trvEntryPoint, 'pack:docker', '-dt', tag, 'run:double'], { cwd: Runtime.mainSourcePath });

    const state = await ExecUtil.getResult(proc, { catch: true });
    console.log(state.stderr);
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