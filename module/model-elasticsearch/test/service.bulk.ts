import { Suite } from '@travetto/test';

import { ModelBulkSuite } from '@travetto/model/support/test/bulk';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}