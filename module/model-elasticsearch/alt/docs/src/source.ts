import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig } from '../../../src/config';
import { ElasticsearchModelService } from '../../../src/service';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(conf);
  }
}
