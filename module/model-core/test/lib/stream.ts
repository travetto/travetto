import * as assert from 'assert';
import * as fs from 'fs';
import * as crypto from 'crypto';
// import * as mime from 'mime';

import { AfterEach, BeforeAll, BeforeEach, Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { BaseModelSuite } from './test.base';
import { ModelStreamSupport } from '../../src/service/stream';

async function getHash(stream: NodeJS.ReadableStream) {
  const hash = crypto.createHash('sha1');
  hash.setEncoding('hex');
  await new Promise((res, rej) => {
    stream.on('end', res);
    stream.on('error', rej);
    stream.pipe(hash);
  });
  return hash.read() as string;
}

async function getStream(resource: string) {
  const file = await ResourceManager.toAbsolutePath(resource);
  const stat = await fs.promises.stat(file);
  const hash = await getHash(fs.createReadStream(file));

  return [
    { size: stat.size, contentType: '', hash },
    fs.createReadStream(file)
  ] as const;
}

@Suite({ skip: true })
export abstract class ModelStreamSuite extends BaseModelSuite<ModelStreamSupport> {

  @BeforeAll()
  async beforeAll() {
    return super.init();
  }

  @BeforeEach()
  async beforeEach() {
    return this.createStorage();
  }

  @AfterEach()
  async afterEach() {
    return this.deleteStorage();
  }

  @Test()
  async writeBasic() {
    const service = await this.service;
    const [meta, stream] = await getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStreamMetadata(meta.hash);
    assert(meta === retrieved);
  }

  @Test()
  async writeStream() {
    const service = await this.service;
    const [meta, stream] = await getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStream(meta.hash);
    assert(await getHash(retrieved) === meta.hash);
  }

  @Test()
  async writeAndDelete() {
    const service = await this.service;
    const [meta, stream] = await getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    await service.deleteStream(meta.hash);

    await assert.rejects(async () => {
      await service.getStream(meta.hash);
    });
  }
}