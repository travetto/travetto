import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Controller, Post, ControllerRegistry, Method, RouteUtil, Get, SerializeInterceptor } from '@travetto/rest';

import { SchemaBody, SchemaQuery } from '../extension/rest';

import { Schema, SchemaRegistry } from '..';

@Schema()
class User {
  id: number = -1;
  name: string;
  age: number;
  active: boolean;
}

@Controller()
class API {
  @Post('/user')
  async saveUser(@SchemaBody() user: User) {
    return user;
  }

  @Get('/user')
  async queryUser(@SchemaQuery() user: User) {
    return user;
  }
}

@Suite()
export class RestTest {

  static getEndpoint(path: string, method: Method) {
    return ControllerRegistry.get(API).endpoints.find(x => x.path === path && x.method === method)!;
  }

  @BeforeAll()
  async before() {
    await SchemaRegistry.init();
    await ControllerRegistry.init();
  }

  @Test()
  async verifyBody() {
    const ep = RestTest.getEndpoint('/user', 'post');

    const handler = RouteUtil.createRouteHandler([new SerializeInterceptor()], ep);

    const res = {
      result: undefined as any,
      statusCode: 201,
      setHeader() { },
      getHeader(field: String) { return ''; },
      send(val: any) {
        this.result = JSON.parse(val);
      },
      status(val: number) { },
      json(val: any) {
        this.send(JSON.stringify(val));
      }
    };

    const user = { id: 0, name: 'bob', age: 20, active: false };

    await handler({ body: user, query: {} } as any, res as any);

    assert(res.result!.name === user.name);

    await handler({ body: { id: 'orange' }, query: {} } as any, res as any);

    assert(/Validation errors have occurred/.test(res.result.message));
    assert(res.result.errors[0].path === 'id');

    await handler({ body: { id: 0, name: 'bob', age: 'a' }, query: {} } as any, res as any);

    assert(/Validation errors have occurred/.test(res.result.message));
    assert(res.result.errors[0].path === 'age');
  }

  @Test()
  async verifyQuery() {
    const ep = RestTest.getEndpoint('/user', 'get');

    const handler = RouteUtil.createRouteHandler([new SerializeInterceptor()], ep);

    const res = {
      result: undefined as any,
      statusCode: 201,
      setHeader() { },
      getHeader(field: String) { return ''; },
      send(val: any) {
        this.result = JSON.parse(val);
      },
      status(val: number) { },
      json(val: any) {
        this.send(JSON.stringify(val));
      }
    };

    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    await handler({ query: user } as any, res as any);

    assert(res.result!.name === user.name);

    await handler({ query: { id: 'orange' } } as any, res as any);

    assert(/Validation errors have occurred/.test(res.result.message));
    assert(res.result.errors[0].path === 'id');

    await handler({ query: { id: 0, name: 'bob', age: 'a' } } as any, res as any);

    assert(/Validation errors have occurred/.test(res.result.message));
    assert(res.result.errors[0].path === 'age');
  }
}
