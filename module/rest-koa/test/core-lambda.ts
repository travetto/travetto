import { RestTestCommon } from '@travetto/rest/test/lib/rest-common';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestCoreLambdaTest extends RestTestCommon {
  constructor() {
    super(true);
  }
}