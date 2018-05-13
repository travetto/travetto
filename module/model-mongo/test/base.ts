import { BeforeAll, AfterAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelMongoSource, ModelMongoConfig } from '../src/service';
import { ModelSource } from '@travetto/model';
import { ConfigLoader } from '@travetto/config';
import { RootRegistry } from '@travetto/registry';
import { DockerContainer } from '@travetto/exec';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(conf);
  }
}

export class BaseMongoTest {

  private container: DockerContainer;

  @BeforeAll()
  async before() {
    const port = 50000 + Math.trunc(Math.random() * 10000);
    process.env.MODEL_MONGO_PORT = `${port}`;

    this.container = new DockerContainer('mongo:latest')
      .forceDestroyOnShutdown()
      .exposePort(port)

    this.container.run('--storageEngine', 'ephemeralForTest', '--port', `${port}`)
    await this.container.waitForPort(port, 2000);

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
    console.log('Destroying');
    this.container.destroy();
  }
}