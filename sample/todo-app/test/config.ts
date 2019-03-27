import { InjectableFactory } from '@travetto/di';
import { ModelSource } from '@travetto/model';
import { ElasticsearchModelSource, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

export class TestConfig {

  @InjectableFactory()
  static testSource(config: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(config);
  }
}
