import { RestTestCommon } from '@travetto/rest/test/lib/rest-common';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreTest extends RestTestCommon {
  constructor() {
    super(3004);
  }
}