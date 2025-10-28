import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { AcceptConfig, AcceptInterceptor, WebRequest, WebResponse } from '@travetto/web';
import { RegistryV2 } from '@travetto/registry';

function unwrapError(err: unknown): unknown {
  if (err instanceof WebResponse && err.body instanceof Error) {
    throw err.body;
  }
  throw err;
}

@Suite()
class AcceptInterceptorSuite {

  @BeforeAll()
  async init() {
    await RegistryV2.init();
  }


  @Test()
  async basicTest() {

    const interceptor = new AcceptInterceptor();
    interceptor.config = AcceptConfig.from({
      types: ['text/plain', 'application/json']
    });
    interceptor.finalizeConfig({ config: interceptor.config, endpoint: undefined! });

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/plain'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.rejects(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/sql'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }).catch(unwrapError), /Content type.*violated/i);
  }

  @Test()
  async wildCard() {

    const interceptor = new AcceptInterceptor();
    interceptor.config = AcceptConfig.from({
      types: ['text/*']
    });
    interceptor.finalizeConfig({ config: interceptor.config, endpoint: undefined! });

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/json'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/plain'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'text/sql'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }));

    await assert.rejects(() => interceptor.filter({
      request: new WebRequest({
        headers: {
          'Content-Type': 'json/text'
        }
      }),
      next: async () => new WebResponse(),
      config: interceptor.config
    }).catch(unwrapError), /Content type.*violated/i);
  }
}