import { Suite } from '@travetto/test';

import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}