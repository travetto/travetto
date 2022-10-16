import { Suite } from '@travetto/test';

import { ModelBulkSuite } from '@travetto/model/support/test/bulk';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';


@Suite()
export class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}