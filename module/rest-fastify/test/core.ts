import { BaseRestTest } from '@travetto/rest/test/lib/rest-core';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreTest extends BaseRestTest {
  constructor() {
    super(3003);
  }
}