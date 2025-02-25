import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}