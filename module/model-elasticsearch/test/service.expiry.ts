import { Suite } from '@travetto/test';

import { ModelExpirySuite } from '@travetto/model/support/test/expiry';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchExpirySuite extends ModelExpirySuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}