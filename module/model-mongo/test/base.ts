import { spawn, Execution } from '@travetto/exec';
import { ChildProcess } from 'child_process';

import * as assert from 'assert';
import * as fs from 'fs';
import * as util from 'util';
import { BeforeAll, AfterAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelMongoSource, ModelMongoConfig } from '..';
import { ModelSource } from '@travetto/model';
import { ConfigLoader } from '@travetto/config';
import { RootRegistry } from '@travetto/registry';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(conf);
  }
}

export class BaseMongoTest {

  private proc: ChildProcess;

  @BeforeAll()
  async before() {
    const port = 50000 + Math.trunc(Math.random() * 10000);
    process.env.MODEL_MONGO_PORT = `${port}`;

    const temp = await util.promisify(fs.mkdtemp)(`/tmp/test`);

    const [cp, exec] = await spawn(`mongod --storageEngine ephemeralForTest --dbpath ${temp} --port ${port}`, { shell: false });
    this.proc = cp;

    await new Promise(x => setTimeout(x, 100));

    ConfigLoader['_initialized'] = false;
    ConfigLoader.initialize();

    await RootRegistry.init();
  }

  @BeforeEach()
  async beforeEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ModelMongoSource;
    return await mms.resetDatabase();
  }

  @AfterAll()
  async destroy() {
    this.proc.kill('SIGKILL');
  }
}