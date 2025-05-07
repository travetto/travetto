import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CacheControl, Controller, Get, Patch } from '@travetto/web';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher';

@CacheControl('1w')
@Controller('/test/response')
class TestResponseCache {
  @CacheControl({ isPrivate: true, cacheableAge: 0 })
  @Get('/uncached')
  getUnCached() {
    return 'hello';
  }

  @CacheControl({ isPrivate: true })
  @Get('/uncached/override')
  getUnCachedOverride() {
    return 'hellozz';
  }

  @CacheControl('1d', { isPrivate: true })
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
class CacheControlInterceptorSuite extends BaseWebSuite {

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
    assert(/private/.test(response.headers.get('Cache-Control')!));
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

    console.log(response.headers);
    assert(response.headers.has('Cache-Control'));
    assert('private,max-age=604800' === response.headers.get('Cache-Control'));
  }
}