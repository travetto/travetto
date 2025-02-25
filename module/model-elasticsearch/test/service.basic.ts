import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchBasicSuite extends ModelBasicSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}