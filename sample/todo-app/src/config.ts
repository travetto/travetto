import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelSource, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';
import { ModelSource } from '@travetto/model';

export class AppConfig {
  @InjectableFactory()
  static getDataSource(config: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(config);
  }
}