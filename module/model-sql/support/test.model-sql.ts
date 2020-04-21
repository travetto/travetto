import { BeforeAll, Suite } from '@travetto/test';
import { TestUtil } from '../test/util';

@Suite()
export abstract class BaseSQLModelTest {

  async init() {
  }

  @BeforeAll()
  async doInit() {
    await TestUtil.initModel(this);
  }
}