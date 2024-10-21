import assert from 'node:assert';
import { pipeline } from 'node:stream/promises';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ExecUtil } from '@travetto/runtime';

import { DockerContainer } from '../src/docker';

@Suite()
export class DockerIOTest {

  fixture = new TestFixtures();

  @Test()
  async test() {
    const container = new DockerContainer('rafakato/alpine-graphicsmagick:latest')
      .forceDestroyOnShutdown()
      .setInteractive(true);

    await container.create(['/bin/sh']);
    await container.start();

    const proc = await container.exec(['gm', 'convert', '-resize', '100x50', '-', '-']);

    const [_, output] = await Promise.all([
      pipeline(await this.fixture.readStream('/download.jpeg'), proc.stdin!),
      toBuffer(proc.stdout!)
    ]);

    assert(true);

    assert(output.length > 100);

    assert((await ExecUtil.getResult(proc)).valid);
  }
}