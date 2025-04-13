import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { AcceptsConfig, AcceptsInterceptor, WebRequest, WebResponse } from '@travetto/web';
import { RootRegistry } from '@travetto/registry';

@Suite()
class AcceptsInterceptorSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async basicTest() {

    const interceptor = new AcceptsInterceptor();
    interceptor.config = AcceptsConfig.from({
      types: ['text/plain', 'application/json']
    });
    interceptor.finalizeConfig(interceptor.config);

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/plain'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.rejects(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/sql'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }), /Content type.*violated/i);
  }

  @Test()
  async wildCard() {

    const interceptor = new AcceptsInterceptor();
    interceptor.config = AcceptsConfig.from({
      types: ['text/*']
    });
    interceptor.finalizeConfig(interceptor.config);

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/json'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/plain'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.doesNotReject(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'text/sql'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }));

    await assert.rejects(() => interceptor.filter({
      req: new WebRequest({
        headers: {
          'Content-Type': 'json/text'
        }
      }),
      next: async () => new WebResponse({ body: null }),
      config: interceptor.config
    }), /Content type.*violated/i);


  }
}