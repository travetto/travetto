import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { EtagInterceptor, WebRequest, WebResponse } from '@travetto/web';
import { TimeUtil } from '@travetto/runtime';

@Suite()
class EtagInterceptorSuite {
  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async post() {
    const interceptor = await DependencyRegistryIndex.getInstance(EtagInterceptor);
    interceptor.config.applies = true;
    interceptor.config.minimumSize = 1;

    const data = Buffer.from(Array(1000).fill([1, 2, 3]).flat());

    const post1 = await interceptor.filter({
      request: new WebRequest({ context: { path: '/', httpMethod: 'POST' } }),
      config: interceptor.config,
      next: async () => new WebResponse({ body: data })
    });

    assert(post1.context.httpStatusCode !== 304);
    assert(post1.headers.has('ETag'));
    assert(post1.headers.get('ETag') === `"${interceptor.computeTag(data)}"`);

    const post2 = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'POST' },
        headers: {
          'If-None-Match': post1.headers.get('ETag')
        }
      }),
      config: interceptor.config,
      next: async () => new WebResponse({ body: data })
    });

    assert(post2.context.httpStatusCode !== 304);
  }

  @Test()
  async get() {
    const interceptor = await DependencyRegistryIndex.getInstance(EtagInterceptor);
    interceptor.config.applies = true;
    interceptor.config.minimumSize = 1;

    const data = Buffer.from(Array(1000).fill([1, 2, 3]).flat());

    const get1 = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'GET' },
        headers: {}
      }),
      config: { ...interceptor.config, cacheable: true },
      next: async () => new WebResponse({ body: data, headers: {} })
    });

    assert(get1.context.httpStatusCode !== 304);
    assert(get1.headers.has('ETag'));
    assert(get1.headers.get('ETag') === `"${interceptor.computeTag(data)}"`);

    const get2 = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'GET' },
        headers: {
          'If-None-Match': get1.headers.get('ETag')
        }
      }),
      config: { ...interceptor.config, cacheable: true },
      next: async () => new WebResponse({
        body: data, headers: {
          'Content-Type': 'application/json',
          'Content-Length': '1000'
        }
      })
    });

    assert(get2.context.httpStatusCode === 304);
    assert(get2.headers.has('Content-Type'));
    assert(get2.headers.has('Etag'));
    assert(!get2.headers.has('Content-Length'));
  }

  @Test()
  async getCacheControl() {
    const interceptor = await DependencyRegistryIndex.getInstance(EtagInterceptor);
    interceptor.config.applies = true;

    const data = Buffer.from(Array(1000).fill([1, 2, 3]).flat());

    const get = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'GET' },
        headers: {
          'Cache-Control': 'no-cache',
          Etag: `"${interceptor.computeTag(data)}"`
        }
      }),
      config: { ...interceptor.config, cacheable: true },
      next: async () => new WebResponse({ body: data, headers: {} })
    });

    assert(get.context.httpStatusCode !== 304);
  }

  @Test()
  async testExpires() {
    const interceptor = await DependencyRegistryIndex.getInstance(EtagInterceptor);
    interceptor.config.applies = true;
    interceptor.config.minimumSize = 1;

    const data = Buffer.from(Array(1000).fill([1, 2, 3]).flat());

    const get = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'GET' },
        headers: {
          'If-Modified-Since': TimeUtil.fromNow('1y').toUTCString(),
          'If-None-Match': `"${interceptor.computeTag(data)}"`
        }
      }),
      config: { ...interceptor.config, cacheable: true },
      next: async () => new WebResponse({
        body: data, headers: {
          'Last-Modified': TimeUtil.fromNow('-1y').toUTCString()
        }
      })
    });

    assert(get.context.httpStatusCode === 304);

    const get2 = await interceptor.filter({
      request: new WebRequest({
        context: { path: '/', httpMethod: 'GET' },
        headers: {
          'If-Modified-Since': TimeUtil.fromNow('-1y').toUTCString(),
          'If-None-Match': `"${interceptor.computeTag(data)}"`
        }
      }),
      config: { ...interceptor.config, cacheable: true },
      next: async () => new WebResponse({
        body: data, headers: {
          'Last-Modified': TimeUtil.fromNow('1y').toUTCString()
        }
      })
    });

    assert(get2.context.httpStatusCode === 304);
  }
}