import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CacheableResponse, Controller, Get, Patch } from '@travetto/web';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher';

@Controller('/test/response')
class TestResponseCache {
  @Get('/uncached')
  getUnCached() {
    return 'hello';
  }

  @CacheableResponse(0)
  @Get('/uncached/override')
  getUnCachedOverride() {
    return 'hello';
  }

  @CacheableResponse('1d')
  @Get('/cached')
  getCached() {
    return 'hello';
  }

  @Patch('/uncached')
  getPatched() {
    return 'hello';
  }
}

@Suite()
class ResponseCacheInterceptorSuite extends BaseWebSuite {

  dispatcherType = LocalRequestDispatcher;

  @Test()
  async testUncachedGet() {
    const response = await this.request({
      context: {
        path: '/test/response/uncached',
        httpMethod: 'GET'
      }
    });

    assert(response.headers.has('Cache-Control'));
    assert(/no-store/.test(response.headers.get('Cache-Control')!));
  }

  @Test()
  async testCachedGet() {
    const response = await this.request({
      context: {
        path: '/test/response/cached',
        httpMethod: 'GET'
      }
    });

    assert(response.headers.has('Cache-Control'));
    assert(/max-age/.test(response.headers.get('Cache-Control')!));
  }

  @Test()
  async testUncachedPatch() {
    const response = await this.request({
      context: {
        path: '/test/response/uncached',
        httpMethod: 'PATCH'
      }
    });

    assert(!response.headers.has('Cache-Control'));
  }

  @Test()
  async testUncachedGetOverride() {
    const response = await this.request({
      context: {
        path: '/test/response/uncached/override',
        httpMethod: 'GET'
      }
    });

    assert(!response.headers.has('Cache-Control'));
  }
}