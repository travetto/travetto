import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig } from '../../../src/config';
import { ElasticsearchModelSource } from '../../../src/source';

export class Init {
  @InjectableFactory({
    primary: true
  })
  static getModelSource(conf: ElasticsearchModelConfig) {
    return new ElasticsearchModelSource(conf);
  }
}
