import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ExecUtil } from '@travetto/base';

import { DockerContainer } from '../src/docker';

@Suite()
export class DockerIOTest {

  fixture = new TestFixtures();

  @Test()
  async test() {
    const container = new DockerContainer('rafakato/alpine-graphicsmagick')
      .forceDestroyOnShutdown()
      .setInteractive(true);

    await container.create(['/bin/sh']);
    await container.start();

    const proc = await container.exec(['gm', 'convert', '-resize', '100x50', '-', '-']);

    (await this.fixture.readStream('/download.jpeg')).pipe(proc.stdin!);

    assert(true);

    await ExecUtil.getResult(proc);
  }
}