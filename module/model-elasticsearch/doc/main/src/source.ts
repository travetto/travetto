import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(conf);
  }
}
