import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchBasicSuite extends ModelBasicSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}