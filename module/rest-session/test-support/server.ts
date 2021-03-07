import * as assert from 'assert';

import { Controller, Get, Body, Post, Put, Query, Request } from '@travetto/rest';
import { Suite, Test } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/test-support/suite';
import { BaseRestSuite } from '@travetto/rest/test-support/base';

import { SessionData, SessionConfig } from '..';
import { ModelSessionProvider } from '../src/extension/model';
import { SessionProvider } from '../src/provider/types';

class Config {
  @InjectableFactory({ primary: true })
  static provider(): SessionProvider {
    return new ModelSessionProvider();
  }
}

@Controller('/test/session')
class TestController {

  @Get('/')
  get(data: SessionData): SessionData {
    data.age = (data.age ?? 0) + 1;
    return data;
  }

  @Post('/complex')
  withParam(@Body() payload: unknown, data: SessionData) {
    data.payload = payload;
  }

  @Put('/query')
  withQuery(@Query() age: number) {
    return { query: age };
  }

  @Put('/body')
  withBody(req: Request) {
    return { body: req.body.age };
  }
}

@Suite()
@InjectableSuite()
export abstract class RestSessionServerSuite extends BaseRestSuite {

  @Inject()
  config: SessionConfig;

  initConifg(opt: Partial<SessionConfig>) {
    return Object.assign(this.config, opt);
  }

  @Test()
  async cookiePersistence() {
    this.initConifg({
      transport: 'cookie',
      maxAge: 10000
    });

    let res = await this.request('get', '/test/session');
    let cookie = res.headers['set-cookie'];
    assert(res.body === { age: 1 });
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'] ?? cookie;
    assert(res.body === { age: 2 });
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'] ?? cookie;
    assert(res.body === { age: 3 });
    res = await this.request('get', '/test/session');
    assert(res.body === { age: 1 });
    cookie = res.headers['set-cookie'] ?? cookie;
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body === { age: 2 });
  }

  @Test()
  async cookieComplex() {
    this.initConifg({
      transport: 'cookie',
      maxAge: 3000
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];
    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerPersistence() {
    const { keyName: key } = this.initConifg({
      transport: 'header',
      renew: true,
      maxAge: 3000
    });

    let res = await this.request('get', '/test/session');
    let header = res.headers[key];
    assert(res.body === { age: 1 });
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body === { age: 2 });
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body === { age: 3 });

    res = await this.request('get', '/test/session');
    assert(res.body === { age: 1 });
    header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body === { age: 2 });
  }

  @Test()
  async headerComplex() {
    const { keyName: key } = this.initConifg({
      transport: 'header',
      maxAge: 3000
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryHeader() {
    const { keyName: key } = this.initConifg({
      transport: 'header',
      maxAge: 100
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await this.wait(100);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryCookie() {
    this.initConifg({
      transport: 'cookie',
      maxAge: 100
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);

    await this.wait(100);

    res = await this.request('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === undefined);
    assert(res.body.age === 1);
  }

  @Test()
  async testExpiryWithExtend() {
    const { keyName: key } = this.initConifg({
      transport: 'header',
      maxAge: 100
    });

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.request('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];

    await this.wait(50);
    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    await this.wait(50);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    await this.wait(50);

    res = await this.request('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);

    assert(res.body.age === 3);
  }
}