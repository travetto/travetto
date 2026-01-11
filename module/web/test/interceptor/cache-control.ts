import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CacheControl, Controller, Get, Patch, SetHeaders, WebResponse } from '@travetto/web';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

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
    return 'hello-zz';
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

  @Get('/special')
  @SetHeaders({
    'Cache-Control': 'orange'
  })
  getSpecial() {
    return 'hello';
  }

  @Get('/special2')
  getSpecial2() {
    return new WebResponse({
      headers: { 'cache-CONTROL': 'blue' }
    });
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

    assert(response.headers.has('Cache-Control'));
    assert('private,max-age=604800' === response.headers.get('Cache-Control'));
  }

  @Test()
  async testSpecial() {
    const response = await this.request({
      context: {
        path: '/test/response/special',
        httpMethod: 'GET'
      }
    });

    assert(response.headers.has('Cache-Control'));
    assert('orange' === response.headers.get('Cache-Control'));

    const response2 = await this.request({
      context: {
        path: '/test/response/special2',
        httpMethod: 'GET'
      }
    });

    assert(response2.headers.has('Cache-Control'));
    assert('blue' === response2.headers.get('Cache-Control'));
  }
}