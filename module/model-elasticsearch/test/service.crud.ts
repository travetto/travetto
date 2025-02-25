import { Suite } from '@travetto/test';

import { ModelCrudSuite } from '@travetto/model/support/test/crud';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchCrudSuite extends ModelCrudSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}