import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';

@Suite()
class ElasticsearchExpirySuite extends ModelExpirySuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}