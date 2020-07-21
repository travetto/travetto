import * as assert from 'assert';
import * as qs from 'querystring';
import { Test, BeforeAll, AfterAll } from '@travetto/test';
import { HttpRequest } from '@travetto/net';
import { DependencyRegistry } from '@travetto/di';
import { ApplicationHandle } from '@travetto/app';
import { RootRegistry } from '@travetto/registry';

import { Controller } from '../../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint';
import { Path, Query } from '../../src/decorator/param';
import { Request } from '../../src/types';
import { RestCookieConfig } from '../../src/interceptor/cookies';


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

  @Patch('regexp/:special(.*poodle.*)')
  withRegexp(@Path() special: string) {
    return { path: special };
  }
}

export abstract class BaseRestTest {

  private server: ApplicationHandle;
  constructor(private port = 3002) { }


  get url() {
    return `http://localhost:${this.port}`;
  }

  @BeforeAll()
  async initServer() {
    const { RestServer } = await import('../../src/server/server');

    await RootRegistry.init();

    const c = await DependencyRegistry.getInstance(RestCookieConfig);
    c.active = true;
    c.secure = false;
    c.signed = false;

    const s = await DependencyRegistry.getInstance(RestServer);
    s.config.port = this.port;
    s.config.ssl.active = false;
    this.server = await s.run();

    const start = Date.now();

    while ((Date.now() - start) < 5000) {
      try {
        await HttpRequest.exec({ url: this.url });
        return; // We good
      } catch  {
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }

  async makeRequst(method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, { query, headers, body }: {
    query?: Record<string, any>;
    body?: Record<string, any>;
    headers?: Record<string, string>;
  } = {}) {
    let q = '';
    if (query && Object.keys(query).length) {
      q = `?${qs.stringify(query)}`;
    }
    return await HttpRequest.execJSON({
      url: `${this.url}/test${path}${q}`,
      method: method.toUpperCase(),
      headers
    }, body);
  }

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
    assert(ret === { path: 'super-poodle-party' });
  }

  @AfterAll()
  async destroySever() {
    await this.server.close?.();
    delete this.server;
  }
}