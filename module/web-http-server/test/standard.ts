import { Suite } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

import { DefaultWebServer } from '../src/default.ts';

@Suite()
export class DefaultWebServerStandardTest extends StandardWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistry.getInstance(DefaultWebServer).then(v => v.serve()).then(v => v.kill);
  }
}