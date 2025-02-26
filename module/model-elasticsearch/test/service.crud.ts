import { Suite } from '@travetto/test';

import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchCrudSuite extends ModelCrudSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}