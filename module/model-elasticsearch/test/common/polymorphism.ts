import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';

import {
  BasePolymorphismSuite, Person, Doctor, Engineer, Firefighter
} from '@travetto/model/test/source/polymorphism';
import { ElasticsearchModelSource } from '../../src/source';
import { ElasticsearchModelConfig } from '../../src/config';

@Suite('Polymorphism')
class PolymorphismSuite extends BasePolymorphismSuite {

  configClass = ElasticsearchModelConfig;
  sourceClass = ElasticsearchModelSource;

  @BeforeAll() doInit() { return this.init(); }

  @Test('Extraction')
  async testRetrieve() {
    const service = (await this.source) as ElasticsearchModelSource;
    const res = service.getClassFromIndexType('person', 'doctor');
    assert(res === Doctor);
  }

  @Test('Multi Query')
  async testMultiQuery() {
    const service = (await this.source) as ElasticsearchModelSource;
    const res = service.buildRawModelFilters([Person, Doctor, Engineer, Firefighter]);

    assert(res.bool.should.length === 4);
    assert(res.bool.should[0].term);
    assert(res.bool.should[1].bool);
    assert(res.bool.should[1].bool!.must.length);

    await this.testBulk();

    const rawRes = await service.getRawMultiQuery<Person>([Firefighter, Engineer], {});
    const items = await service.convertRawResponse(rawRes);
    assert(items.length === 2);
    assert(items[0] instanceof Firefighter);
  }
}
