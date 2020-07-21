import * as assert from 'assert';
import { Test, BeforeAll, AfterAll } from '@travetto/test';

import { Controller } from '../../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint';
import { Path, Query } from '../../src/decorator/param';
import { Request } from '../../src/types';
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
  withCookie(req: Request) {
    console.log('COokie', req.cookies.get('orange'));
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
    const ret = await this.makeRequst('get', '/json');
    assert(ret === { json: true });
  }

  @Test()
  async getParam() {
    const ret = await this.makeRequst('post', '/param/bob');
    assert(ret === { param: 'bob' });
  }

  @Test()
  async putQuery() {
    const ret = await this.makeRequst('put', '/query', {
      query: {
        age: 20
      }
    });
    assert(ret === { query: 20 });

    await assert.rejects(() => this.makeRequst('put', '/query', {
      query: {
        age: 'blue'
      }
    }), /Number/i);
  }

  @Test()
  async testCookie() {
    const ret = await this.makeRequst('delete', '/cookie', {
      headers: {
        Cookie: `orange=yummy`
      }
    });
    assert(ret === { cookie: 'yummy' });
  }

  @Test()
  async testRegex() {
    const ret = await this.makeRequst('patch', '/regexp/super-poodle-party');
    assert(ret === { path: 'poodle' });
  }
}