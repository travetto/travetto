import * as mongo from 'mongodb';
import * as assert from 'assert';
import * as fs from 'fs';
import * as util from 'util';

import { AssetService, AssetUtil, AssetSource } from '@travetto/asset';
import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { MongoAssetSource } from '../src/source';
import { MongoAssetConfig } from '../src/config';

const fsStat = util.promisify(fs.stat);

class Config extends MongoAssetConfig {
  @InjectableFactory()
  static getConf(): MongoAssetConfig {
    return new MongoAssetConfig();
  }
  @InjectableFactory()
  static getSource(cfg: MongoAssetConfig): AssetSource {
    return new MongoAssetSource(cfg);
  }
}

@Suite()
class TestAssetService {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @BeforeEach()
  async resetDb() {
    const source = await DependencyRegistry.getInstance(MongoAssetSource);
    const client = source['mongoClient'] as mongo.MongoClient;

    await client.db().dropDatabase();
  }
}