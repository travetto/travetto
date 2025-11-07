import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { RegistryV2 } from '@travetto/registry';
import { TrustProxyInterceptor, WebRequest, WebResponse } from '@travetto/web';

@Suite()
class TrustProxyInterceptorSuite {

  @BeforeAll()
  async init() {
    await RegistryV2.init();
  }

  @Test()
  async simpleTest() {
    const interceptor = await DependencyRegistryIndex.getInstance(TrustProxyInterceptor);
    interceptor.config.applies = true;

    const request = new WebRequest({
      context: {
        httpMethod: 'GET',
        path: '/',
        connection: {
          ip: 'green',
          httpProtocol: 'http'
        }
      },
      headers: {
        'X-Forwarded-Proto': 'blah'
      }
    });

    await interceptor.filter({
      request,
      config: interceptor.config,
      next: async () => new WebResponse()
    });

    assert(request.context.connection?.ip === 'green');
    assert(!request.headers.has('X-Forwarded-Proto'));
  }

  @Test()
  async overrideFail() {
    const interceptor = await DependencyRegistryIndex.getInstance(TrustProxyInterceptor);
    interceptor.config.applies = true;
    const request = new WebRequest({
      context: {
        httpMethod: 'GET',
        path: '/',
        connection: {
          ip: 'green',
          httpProtocol: 'http'
        }
      },
      headers: {
        'X-Forwarded-For': 'blue',
        'X-Forwarded-Proto': 'blah'
      }
    });

    await interceptor.filter({
      request,
      config: interceptor.config,
      next: async () => new WebResponse()
    });

    assert(request.context.connection?.ip === 'green');
    assert(!request.headers.has('X-Forwarded-For'));
    assert(!request.headers.has('X-Forwarded-Proto'));
  }

  @Test()
  async overrideSuccess() {
    const interceptor = await DependencyRegistryIndex.getInstance(TrustProxyInterceptor);
    interceptor.config.applies = true;
    const request = new WebRequest({
      context: {
        httpMethod: 'GET',
        path: '/',
        connection: {
          ip: 'green',
          httpProtocol: 'http'
        }
      },
      headers: {
        'X-Forwarded-For': 'blue',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'google.com',
      }
    });

    await interceptor.filter({
      request,
      config: { ...interceptor.config, ips: ['green'] },
      next: async () => new WebResponse()
    });

    assert(request.context.connection?.ip === 'blue');
    assert(request.context.connection.host === 'google.com');
    assert(request.context.connection?.httpProtocol === 'https');
    assert(!request.headers.has('X-Forwarded-For'));
    assert(!request.headers.has('X-Forwarded-Proto'));
    assert(!request.headers.has('X-Forwarded-Host'));
  }

  @Test()
  async wildcard() {
    const interceptor = await DependencyRegistryIndex.getInstance(TrustProxyInterceptor);
    interceptor.config.applies = true;
    const request = new WebRequest({
      context: {
        httpMethod: 'GET',
        path: '/',
        connection: {
          ip: 'green',
          httpProtocol: 'http'
        }
      },
      headers: {
        'X-Forwarded-For': 'blue',
      }
    });

    await interceptor.filter({
      request,
      config: { ...interceptor.config, ips: ['*'] },
      next: async () => new WebResponse()
    });

    assert(request.context.connection?.ip === 'blue');
    assert(!request.headers.has('X-Forwarded-For'));
  }
}