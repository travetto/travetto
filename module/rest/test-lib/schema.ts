// @file-if @travetto/schema
import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { Schema, SchemaRegistry } from '@travetto/schema';

import { Controller, Redirect, Post, Get, SchemaBody, SchemaQuery, MethodOrAll, ControllerRegistry } from '../..';

import { BaseRestSuite } from './base';

interface UserShape {
  id: number | undefined;
  age: number;
  name: string;
  active: boolean;
}

@Schema()
class SimpleUser {
  id: number;
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

@Controller('/test/schema')
class SchemaAPI {
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
    return Promise.all([1, 2, 3,].map(x => getUser(x)));
  }

  @Get('/allShapes')
  async allShape() {
    return Promise.all([1, 2, 3,].map(async x => ({ key: x, count: 5 })));
  }

  @Get('/classShape')
  async classShape() {
    return new SimpleUser();
  }

  @Get('/renderable')
  async renderable() {
    return new Redirect('google.com');
  }

  @Get('/customRender')
  async customRender() {
    return {
      /**
       * @returns {Promise<User>}
       */
      render() {

      }
    };
  }
}


function getEndpoint(path: string, method: MethodOrAll) {
  return ControllerRegistry.get(SchemaAPI)
    .endpoints.find(x => x.path === path && x.method === method)!;
}


@Suite()
export abstract class SchemaRestServerSuite extends BaseRestSuite {

  @Test()
  async verifyBody() {
    const user = { id: 0, name: 'bob', age: 20, active: false };

    let res = await this.makeRequst('post', '/test/schema/user', { body: user });

    assert(res.body.name === user.name);

    res = await this.makeRequst('post', '/test/schema/user', { body: { id: 'orange' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'id');

    res = await this.makeRequst('post', '/test/schema/user', { body: { id: 0, name: 'bob', age: 'a' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'age');
  }

  @Test()
  async verifyQuery() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    let res = await this.makeRequst('get', '/test/schema/user', { query: user });

    assert(res.body.name === user.name);

    res = await this.makeRequst('get', '/test/schema/user', { query: { id: 'orange' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'id');

    res = await this.makeRequst('get', '/test/schema/user', { query: { id: 0, name: 'bob', age: 'a' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'age');
  }

  @Test()
  async verifyInterface() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    let res = await this.makeRequst('get', '/test/schema/interface', { query: user });

    assert(res.body.name === user.name);

    res = await this.makeRequst('get', '/test/schema/interface', { query: { id: 'orange' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'id');

    res = await this.makeRequst('get', '/test/schema/interface', { query: { id: 0, name: 'bob', age: 'a' } });

    assert(res.status === 400);
    assert(/Validation errors have occurred/.test(res.body.message));
    assert(res.body.errors[0].path === 'age');
  }

  @Test()
  async verifyVoid() {
    const ep = getEndpoint('/void', 'get');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyVoidAll() {
    const ep = getEndpoint('/voidAll', 'get');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyList() {
    const ep = getEndpoint('/users', 'get');
    assert(ep.responseType?.type === User);
  }

  @Test()
  async verifyShapeAll() {
    const ep = getEndpoint('/allShapes', 'get');
    console.log(`${ep.responseType}`);
  }

  @Test()
  async verifyShapeClass() {
    const ep = getEndpoint('/classShape', 'get');
    assert(ep.responseType);
    assert(SchemaRegistry.has(ep.responseType!.type));
  }

  @Test()
  async verifyRenderable() {
    const ep = getEndpoint('/renderable', 'get');
    assert(ep.responseType?.type === undefined);
  }

  @Test()
  async verifyCustomRenderable() {
    const ep = getEndpoint('/customRender', 'get');
    assert(ep.responseType?.type === User);
  }
}
