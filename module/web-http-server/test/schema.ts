import { Suite } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';
import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

import { DefaultWebServer } from '../src/default.ts';

@Suite()
export class DefaultWebServerSchemaTest extends SchemaWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    return DependencyRegistry.getInstance(DefaultWebServer).then(v => v.serve()).then(v => v.kill);
  }
}