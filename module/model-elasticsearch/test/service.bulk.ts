import { Suite } from '@travetto/test';

import { ModelBulkSuite } from '@travetto/model/test-support/bulk';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';


@Suite()
export class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}