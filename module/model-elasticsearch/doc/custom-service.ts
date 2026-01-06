import { InjectableFactory } from '@travetto/di';
import { type ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}
