import * as assert from 'assert';

import { Controller, Get, Body, Post, Put, Query, Request } from '@travetto/rest';
import { BaseRestSuite } from '@travetto/rest/test/lib/base';
import { AfterAll, BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { SessionData, SessionConfig } from '../..';

@Controller('/test/session')
class TestController {

  @Get('/')
  get(data: SessionData): any {
    data.age = (data.age ?? 0) + 1;
    return data;
  }

  @Post('/complex')
  withParam(@Body() payload: any, data: SessionData) {
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

@Suite({ skip: true })
export abstract class RestSessionServerSuite extends BaseRestSuite {

  @BeforeAll()
  async before() { return this.initServer(); }

  @AfterAll()
  async after() { return this.destroySever(); }

  get config() {
    return DependencyRegistry.getInstance(SessionConfig);
  }

  @Test()
  async cookiePersistence() {
    (await this.config).transport = 'cookie';

    let res = await this.makeRequst('get', '/test/session');
    let cookie = res.headers['set-cookie'];
    assert(res.body === { age: 1 });
    res = await this.makeRequst('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'];
    assert(res.body === { age: 2 });
    res = await this.makeRequst('get', '/test/session', { headers: { Cookie: cookie } });
    cookie = res.headers['set-cookie'];
    assert(res.body === { age: 3 });
    res = await this.makeRequst('get', '/test/session');
    assert(res.body === { age: 1 });
    cookie = res.headers['set-cookie'];
    res = await this.makeRequst('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body === { age: 2 });
  }

  @Test()
  async cookieComplex() {
    (await this.config).transport = 'cookie';

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.makeRequst('post', '/test/session/complex', { body: payload });
    const cookie = res.headers['set-cookie'];
    res = await this.makeRequst('get', '/test/session', { headers: { Cookie: cookie } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }

  @Test()
  async headerPersistence() {
    (await this.config).transport = 'header';
    const key = (await this.config).keyName;

    let res = await this.makeRequst('get', '/test/session');
    let header = res.headers[key];
    assert(res.body === { age: 1 });
    res = await this.makeRequst('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key];
    assert(res.body === { age: 2 });
    res = await this.makeRequst('get', '/test/session', { headers: { [key]: header } });
    header = res.headers[key];
    assert(res.body === { age: 3 });
    res = await this.makeRequst('get', '/test/session');
    assert(res.body === { age: 1 });
    header = res.headers[key];
    res = await this.makeRequst('get', '/test/session', { headers: { [key]: header } });
    assert(res.body === { age: 2 });
  }

  @Test()
  async headerComplex() {
    (await this.config).transport = 'header';
    const key = (await this.config).keyName;

    const payload = { name: 'Bob', color: 'green', faves: [1, 2, 3] };
    let res = await this.makeRequst('post', '/test/session/complex', { body: payload });
    const header = res.headers[key];
    res = await this.makeRequst('get', '/test/session', { headers: { [key]: header } });
    assert(res.body.payload === payload);
    assert(res.body.age === 1);
  }
}