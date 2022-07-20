import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { StreamUtil } from '@travetto/boot';

import { Controller } from '../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../src/decorator/endpoint';
import { Path, Query } from '../src/decorator/param';
import { Request, Response } from '../src/types';
import { BaseRestSuite } from './base';
import { Produces, SetHeaders } from '../src/decorator/common';
import { Renderable } from '../src/response/renderable';

@Controller('/test')
class TestController {
  @Get('/json')
  getJSON() {
    return { json: true };
  }

  @Post('/param/:param')
  withParam(@Path() param: string) {
    return { param };
  }

  @Put('/query')
  withQuery(@Query() age: number) {
    return { query: age };
  }

  @Put('/body')
  withBody(req: Request) {
    return { body: req.body.age };
  }

  @Delete('/cookie')
  withCookie(req: Request, res: Response) {
    res.cookies.set('flavor', 'oreo');
    return { cookie: req.cookies.get('orange') };
  }

  @Patch('/regexp/super-:special-party')
  withRegexp(@Path() special: string) {
    return { path: special };
  }

  @Get('/stream')
  @SetHeaders({ 'Content-Type': 'text/plain' })
  getStream() {
    return StreamUtil.bufferToStream(Buffer.from('hello'));
  }

  @Get('/buffer')
  @Produces('text/plain')
  getBuffer() {
    return Buffer.from('hello');
  }

  @Get('/renderable')
  @Produces('text/plain')
  getRenderable(): Renderable {
    return {
      /**
       * @returns {string}
       */
      render(res) {
        return res.send('hello');
      }
    };
  }

  @Get('/fullUrl')
  getFullUrl(req: Request) {
    return {
      url: req.url,
      path: req.path
    };
  }
}

@Suite()
export abstract class RestServerSuite extends BaseRestSuite {

  @Test()
  async getJSON() {
    const { body: ret } = await this.request('get', '/test/json');
    assert(ret === { json: true });
  }

  @Test()
  async getParam() {
    const { body: ret } = await this.request('post', '/test/param/bob');
    assert(ret === { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const { body: ret } = await this.request('put', '/test/query', {
      query: {
        age: '20'
      }
    });
    assert(ret === { query: 20 });

    await assert.rejects(() => this.request('put', '/test/query', {
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async postBody() {
    const { body: ret } = await this.request('put', '/test/body', {
      body: {
        age: 20
      }
    });
    assert(ret === { body: 20 });
  }

  @Test()
  async testCookie() {
    const { body: ret, headers } = await this.request('delete', '/test/cookie', {
      headers: {
        Cookie: 'orange=yummy'
      }
    });
    console.log('Headers', { headers });
    assert(/flavor.*oreo/.test(headers['set-cookie'] ?? ''));
    assert(ret === { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const { body: ret } = await this.request('patch', '/test/regexp/super-poodle-party');
    assert(ret === { path: 'poodle' });
  }

  @Test()
  async testBuffer() {
    const { body: ret } = await this.request('get', '/test/buffer');
    assert(ret === 'hello');
  }

  @Test()
  async testStream() {
    try {
      const { body: ret } = await this.request('get', '/test/stream');
      assert(ret === 'hello');
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  }

  @Test()
  async testRenderable() {
    const { body: ret } = await this.request('get', '/test/renderable');
    assert(ret === 'hello');
  }

  @Test()
  async testFullUrl() {
    const { body: ret } = await this.request('get', '/test/fullUrl');
    assert(ret === { url: '/test/fullUrl', path: '/test/fullUrl' });
  }
}