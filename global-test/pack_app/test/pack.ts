import assert from 'assert';

import { ExecUtil } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

@Suite()
export class PackAppSuite {

  @Test({ timeout: 60000 })
  async testPack() {
    const tag = `tag-${Math.random()}`.replace(/[0][.]/, '');
    const res = ExecUtil.spawn('npx', ['trv', 'pack:docker', '-dt', tag, 'run:double'], {
      cwd: RootIndex.mainModule.sourcePath,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      catchAsResult: true
    });
    const state = await res.result;
    assert(state.valid);

    const res2 = ExecUtil.spawn('docker', ['run', `travetto-test_pack_app:${tag}`, '30'], {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      catchAsResult: true,
    });
    const state2 = await res2.result;
    assert(state2.code === 0);
    assert(state2.stdout.includes('Result: 60'));
    assert(/Result: 60/.test(state2.stdout));
  }
}