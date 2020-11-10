import * as assert from 'assert';
import * as fs from 'fs';
import * as crypto from 'crypto';
// import * as mime from 'mime';

import { AfterEach, BeforeAll, BeforeEach, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { BaseModelTest } from './test.base';
import { ModelStreamSupport } from '../../src/service/stream';

async function getHash(stream: NodeJS.ReadableStream) {
  const hash = crypto.createHash('sha1');
  // change to 'binary' if you want a binary hash.
  hash.setEncoding('hex');
  await new Promise((res, rej) => stream.pipe(hash).on('end', res));
  return hash.read() as string;
}

async function getStream(resource: string) {
  console.log(ResourceManager.getPaths());
  const file = await ResourceManager.toAbsolutePath(resource);
  const stat = await fs.promises.stat(file);
  const hash = await getHash(fs.createReadStream(file));

  return [
    { size: stat.size, contentType: '', hash },
    fs.createReadStream(file)
  ] as const;
}


export class ModelStreamSuite extends BaseModelTest<ModelStreamSupport> {

  @BeforeAll()
  async beforeAll() {
    return super.init();
  }

  @BeforeEach()
  async beforeEach() {
    return this.initDb();
  }

  @AfterEach()
  async afterEach() {
    return this.cleanup();
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