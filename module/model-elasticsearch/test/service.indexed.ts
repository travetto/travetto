import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}