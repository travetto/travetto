import { Suite, BeforeAll } from '@travetto/test';

import { BaseGeoTestSuite } from '@travetto/model/test/source/geo';
import { ElasticsearchModelConfig } from '../../src/config';
import { ElasticsearchModelSource } from '../../src/source';

@Suite()
export class GeoTestSuite extends BaseGeoTestSuite {

  configClass = ElasticsearchModelConfig;
  sourceClass = ElasticsearchModelSource;

  @BeforeAll()
  async doInit() {
    return await this.init();
  }
}