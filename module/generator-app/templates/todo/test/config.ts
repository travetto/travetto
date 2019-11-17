// {{#modules.model-mongo}}
import { MongoModelSource, MongoModelConfig } from '@travetto/model-mongo';
// {{/modules.model-mongo}}
// {{#modules.model-elasticsearch}}
import { ElasticsearchModelSource, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';
// {{/modules.model-elasticsearch}}
import { ModelSource } from '@travetto/model';
import { InjectableFactory } from '@travetto/di';

class Config {
  // {{#modules.model-mongo}}
  @InjectableFactory()
  static getMongoSource(config: MongoModelConfig): ModelSource {
    return new MongoModelSource(config);
  }
  // {{/modules.model-mongo}}
  // {{#modules.model-elasticsearch}}
  @InjectableFactory()
  static getElasticsearchSource(config: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(config);
  }
  // {{/modules.model-elasticsearch}}
}