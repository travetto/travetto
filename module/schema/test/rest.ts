// @file-if @travetto/rest
import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Controller, Post, ControllerRegistry, RouteUtil, Get, SerializeInterceptor, MethodOrAll } from '@travetto/rest';
import { RootRegistry } from '@travetto/registry';

import { SchemaBody, SchemaQuery } from '../src/extension/rest';
import { Schema } from '../src/decorator/schema';

interface UserShape {
  id: number | undefined;
  age: number;
  name: string;
  active: boolean;
}

@Schema()
class User {
  id: number = -1;
  name: string;
  age: number;
  active: boolean;
}

async function getUser(x: number) {
  return User.from({});
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

  @Get('/interface')
  async ifUser(@SchemaQuery() user: UserShape) {
    return user;
  }

  @Get('/void')
  async voidUser() {
    return Promise.resolve((() => { })());
  }

  @Get('/voidAll')
  async voidAllUser() {
    return Promise.resolve([1, 2, 3].map(() => { }));
  }

  @Get('/users')
  async allUsers() {
    return [1, 2, 3,].map(x => getUser(x));
  }
}

@Suite()
export class RestTest {

  static getEndpoint(path: string, method: MethodOrAll) {
    return ControllerRegistry.get(API).endpoints.find(x => x.path === path && x.method === method)!;
  }

  static getResponse() {
    return {
      result: undefined as any,
      statusCode: 201,
      setHeader() { },
      getHeader(field: string) { return ''; },
      send(val: any) {
        this.result = JSON.parse(val);
      },
      status(val: number) { },
      json(val: any) {
        this.send(JSON.stringify(val));
      }
    };
  }

  @BeforeAll()
  async before() {
    await RootRegistry.init();
  }

  @Test()
  async verifyBody() {
    const ep = RestTest.getEndpoint('/user', 'post');

    const handler = RouteUtil.createRouteHandler([new SerializeInterceptor()], ep);

    const res = RestTest.getResponse();
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

    const res = RestTest.getResponse();

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

  @Test()
  async verifyInterface() {
    const ep = RestTest.getEndpoint('/interface', 'get');

    const handler = RouteUtil.createRouteHandler([new SerializeInterceptor()], ep);

    const res = RestTest.getResponse();

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

  @Test()
  async verifyVoid() {
    const ep = RestTest.getEndpoint('/void', 'get');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyVoidAll() {
    const ep = RestTest.getEndpoint('/voidAll', 'get');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyList() {
    const ep = RestTest.getEndpoint('/users', 'get');
    assert(ep.responseType?.type === User);
  }
}
