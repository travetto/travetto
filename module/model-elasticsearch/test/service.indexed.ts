import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}