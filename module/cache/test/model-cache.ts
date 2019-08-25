import * as assert from 'assert';

import { Suite, BeforeAll, BeforeEach, AfterEach, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ModelRegistry, ModelService, ModelSource } from '@travetto/model';

import { CacheTestSuite } from './cache';
import { ModelCacheStore, CacheModel } from '../extension/model.store';

import { SchemaRegistry } from '@travetto/schema';
import { MongoModelConfig } from '@travetto/model-mongo';

@Suite()
export class ModelCacheSuite extends CacheTestSuite {

  configClass = MongoModelConfig;
  baseLatency = 100;

  get source() {
    return DependencyRegistry.getInstance(ModelSource);
  }

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
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