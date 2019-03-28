// {{#modules.map.model-mongo}}
import { MongoModelSource, MongoModelConfig } from '@travetto/model-mongo';
// {{/modules.map.model-mongo}}
// {{#modules.map.model-elasticsearch}}
import { ElasticsearchModelSource, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';
// {{/modules.map.model-elasticsearch}}
import { ModelSource } from '@travetto/model';
import { InjectableFactory } from '@travetto/di';

class Config {
  @InjectableFactory()
  // {{#modules.map.model-mongo}}
  static getMongoSource(config: MongoModelConfig): ModelSource {
    return new MongoModelSource(config);
  }
  // {{/modules.map.model-mongo}}
  // {{#modules.map.model-elasticsearch}}
  static getElasticsearchSource(config: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(config);
  }
  // {{/modules.map.model-elasticsearch}}
}