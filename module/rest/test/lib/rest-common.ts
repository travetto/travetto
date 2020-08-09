import * as assert from 'assert';
import { Test, BeforeAll, AfterAll } from '@travetto/test';

import { Controller } from '../../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint';
import { Path, Query } from '../../src/decorator/param';
import { Request, Response } from '../../src/types';
import { BaseRestTest } from './rest-base';


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

  @Delete('/cookie')
  withCookie(req: Request, res: Response) {
    res.cookies.set('flavor', 'oreo');
    return { cookie: req.cookies.get('orange') };
  }

  @Patch('/regexp/super-:special-party')
  withRegexp(@Path() special: string) {
    return { path: special };
  }
}

export abstract class RestTestCommon extends BaseRestTest {

  @BeforeAll()
  async before() { return this.initServer(); }

  @AfterAll()
  async after() { return this.destroySever(); }

  @Test()
  async getJSON() {
    const { body: ret } = await this.makeRequst('get', '/test/json');
    assert(ret === { json: true });
  }

  @Test()
  async getParam() {
    const { body: ret } = await this.makeRequst('post', '/test/param/bob');
    assert(ret === { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const { body: ret } = await this.makeRequst('put', '/test/query', {
      query: {
        age: 20
      }
    });
    assert(ret === { query: 20 });

    await assert.rejects(() => this.makeRequst('put', '/test/query', {
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async testCookie(res: Response) {
    const { body: ret, headers } = await this.makeRequst('delete', '/test/cookie', {
      headers: {
        Cookie: `orange=yummy`
      }
    });
    console.log(headers);
    assert(/flavor.*oreo/.test(headers['set-cookie']));
    assert(ret === { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const { body: ret } = await this.makeRequst('patch', '/test/regexp/super-poodle-party');
    assert(ret === { path: 'poodle' });
  }
}