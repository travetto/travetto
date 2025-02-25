import { Suite } from '@travetto/test';

import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchExpirySuite extends ModelExpirySuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}