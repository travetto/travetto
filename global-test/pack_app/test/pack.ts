import assert from 'node:assert';

import { Spawn } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

@Suite()
export class PackAppSuite {

  @Test({ timeout: 60000 })
  async testPack() {
    const tag = `tag-${Math.random()}`.replace(/[0][.]/, '');
    const imageName = 'travetto-test_pack_app';
    const res = await Spawn.exec('npx', ['trv', 'pack:docker', '-dt', tag, 'run:double'], {
      cwd: RuntimeIndex.mainModule.sourcePath,
      env: { PATH: process.env.PATH }
    }).complete;
    assert(res.code === 0);
    assert(res.valid);

    const res2 = await Spawn.exec('docker', ['run', '--rm', `${imageName}:${tag}`, '30']).complete;

    assert(await res2.stderr === '');
    assert(res2.code === 0);

    const res3 = await Spawn.exec('docker', ['image', 'rm', '--force', `${imageName}:${tag}`]).complete;

    assert(res3.stdout?.includes('Result: 60'));
    assert(/Result: 60/.test(res3.stdout ?? ''));
  }
}