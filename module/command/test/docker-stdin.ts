import assert from 'node:assert';
import { pipeline } from 'node:stream/promises';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ExecUtil, MemoryWritable } from '@travetto/base';

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

    const output = new MemoryWritable();

    await Promise.all([
      pipeline(await this.fixture.readStream('/download.jpeg'), proc.stdin!),
      pipeline(proc.stdout!, output)
    ]);

    assert(true);

    assert(output.toBuffer().length > 100);

    assert((await ExecUtil.getResult(proc)).valid);
  }
}