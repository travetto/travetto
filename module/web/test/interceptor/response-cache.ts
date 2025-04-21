import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CacheControl, ConfigureInterceptor, Controller, Get, Patch, ResponseCacheInterceptor } from '@travetto/web';

import { BaseWebSuite } from '../../support/test/suite/base';
import { LocalRequestDispatcher } from '../../support/test/dispatcher';

@Controller('/test/response')
class TestResponseCache {
  @Get('/uncached')
  getUnCached() {
    return 'hello';
  }

  @ConfigureInterceptor(ResponseCacheInterceptor, { mode: 'allow' })
  @Get('/uncached/override')
  getUnCachedOverride() {
    return 'hello';
  }

  @CacheControl('1d')
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
    assert(/no-cache/.test(response.headers.get('Cache-Control')!));
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