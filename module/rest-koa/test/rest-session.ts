// @file-if @travetto/rest-session

import { RestSessionServerSuite } from '@travetto/rest-session/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(3002);
  }
}