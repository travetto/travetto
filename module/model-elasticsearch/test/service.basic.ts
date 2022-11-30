import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchBasicSuite extends ModelBasicSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}