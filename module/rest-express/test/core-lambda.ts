import { RestTestCommon } from '@travetto/rest/test/lib/rest-common';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreLambdaTest extends RestTestCommon {
  constructor() {
    super(true);
  }
}