import assert from 'node:assert';
import fs from 'fs/promises';

import { Suite, Test } from '@travetto/test';
import { TimeUtil } from '@travetto/runtime';
import { ModelRegistryIndex } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-file';

import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ExpiryUser, ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';

@Suite()
export class FileBasicSuite extends ModelBasicSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileCrudSuite extends ModelCrudSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileBlobSuite extends ModelBlobSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}

@Suite()
export class FileExpirySuite extends ModelExpirySuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;

  @Test()
  async ensureCulled() {
    const service = await this.service;
    const config = await DependencyRegistry.getInstance(this.configClass);
    const store = ModelRegistryIndex.getStore(ExpiryUser);
    const folder = `${config.folder}/${config.namespace}/${store}`;

    const countFiles = () => fs.stat(folder)
      .then(() => fs.readdir(folder, { recursive: true }), () => [])
      .then(v => v.filter(x => x.endsWith('.json')))
      .then(v => v.length);

    let total;
    let allFiles = await countFiles();

    total = await this.getSize(ExpiryUser);
    assert(total === 0);
    assert(allFiles === 0);

    // Create
    await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: TimeUtil.fromNow(500, 'ms'),
    }));

    allFiles = await countFiles();
    assert(allFiles > 0);

    // Let expire
    await this.wait(1000);
    await service.deleteExpired(ExpiryUser);

    total = await this.getSize(ExpiryUser);
    allFiles = await countFiles();
    assert(total === 0);
    assert(allFiles === 0);
  }
}