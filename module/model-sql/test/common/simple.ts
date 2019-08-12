import * as assert from 'assert';

import { Suite, BeforeAll, Test } from '@travetto/test';
import { BaseSimpleSourceSuite } from '@travetto/model/test/source/simple';
import { Model } from '@travetto/model';

import { SQLModelSource } from '../../src/source';
import { SQLModelConfig } from '../../src/config';
import { TestUtil } from '../util';

@Model()
class Bools {
  id?: string;
  value?: boolean;
}

@Suite('Simple Save')
class SimpleSuite extends BaseSimpleSourceSuite {

  configClass = SQLModelConfig;
  sourceClass = SQLModelSource;

  @BeforeAll()
  doInit() {
    return TestUtil.init(this);
  }

  @Test('verify empty queries')
  async testEmptyCheck() {
    const service = await this.service;
    await service.bulkProcess(Bools, [true, false, null, false, true, undefined, null].map(x => {
      return {
        insert: Bools.from({
          value: x!
        })
      };
    }));

    const results = await service.getAllByQuery(Bools, {});
    assert(results.length === 7);

    const results2 = await service.getAllByQuery(Bools, {
      where: {
        value: {
          $exists: true
        }
      }
    });

    assert(results2.length === 4);

    const results3 = await service.getAllByQueryString(Bools, {
      query: 'value != true'
    });
    assert(results3.length === 5);

    const results4 = await service.getAllByQueryString(Bools, {
      query: 'value != false'
    });
    assert(results4.length === 5);
  }
}