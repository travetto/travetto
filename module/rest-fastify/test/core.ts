import { RestTestCommon } from '@travetto/rest/test/lib/rest-common';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestCoreTest extends RestTestCommon {
  constructor() {
    super(3003);
  }
}