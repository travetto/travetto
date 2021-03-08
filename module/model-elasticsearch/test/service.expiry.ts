import { Suite } from '@travetto/test';

import { ModelExpirySuite } from '@travetto/model/test-support/expiry';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchExpirySuite extends ModelExpirySuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}