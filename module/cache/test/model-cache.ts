import { Suite, BeforeAll, BeforeEach, AfterEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ModelRegistry, ModelService, ModelSource } from '@travetto/model';

import { CacheTestSuite } from './cache';
import { ModelCacheStore } from '../extension/model.store';

import { SchemaRegistry } from '@travetto/schema';
import { SQLModelConfig } from '@travetto/model-sql';
import { TestUtil } from '@travetto/model-sql/test/util';

@Suite()
export class ModelCacheSuite extends CacheTestSuite {

  configClass = SQLModelConfig;
  baseLatency = 100;

  get source() {
    return DependencyRegistry.getInstance(ModelSource);
  }

  @BeforeAll()
  async initAll() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    await TestUtil.initModel(this);
    const config = await DependencyRegistry.getInstance(this.configClass);
    config.user = 'root';
    config.password = 'password';
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    await ModelRegistry.init();

    const svc = await DependencyRegistry.getInstance(ModelService);
    this.service.store = new ModelCacheStore(svc);
  }

  @BeforeEach()
  async initDb() {
    const mms = await this.source;
    await mms.initDatabase();
  }

  @AfterEach()
  async reinit() {
    const mms = await this.source;
    await mms.clearDatabase();
  }
}