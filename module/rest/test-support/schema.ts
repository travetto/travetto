// @file-if @travetto/schema
import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Schema, SchemaRegistry } from '@travetto/schema';
import { Controller, Redirect, Post, Get, QuerySchema, MethodOrAll, ControllerRegistry } from '@travetto/rest';

import { BaseRestSuite } from './base';
import { Path } from '../src/decorator/param';
import { Response } from '../src/types';

type Errors = { errors: { path: string }[], message: string };

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
  async saveUser(user: User) {
    return user;
  }

  @Get('/user')
  async queryUser(user: User) {
    return user;
  }

  @Get('/interface')
  async ifUser(@QuerySchema() user: UserShape) {
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

  @Get('/classShape/:shape')
  async classShape(@Path('shape') sh: string) {
    return new SimpleUser();
  }

  @Get('/renderable/:age')
  async renderable(age: number) {
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

  /**
   * @returns {Promise<User>}
   */
  @Get('/customRender2')
  async customRender2(res: Response) {
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

    const res1 = await this.request<UserShape>('post', '/test/schema/user', { body: user });

    assert(res1.body.name === user.name);

    const res2 = await this.request<Errors>('post', '/test/schema/user', { body: { id: 'orange' }, throwOnError: false });

    assert(res2.status === 400);
    assert(/Validation errors have occurred/.test(res2.body.message));
    assert(res2.body.errors[0].path === 'id');

    const res3 = await this.request<Errors>('post', '/test/schema/user', { body: { id: 0, name: 'bob', age: 'a' }, throwOnError: false });

    assert(res3.status === 400);
    assert(/Validation errors have occurred/.test(res3.body.message));
    assert(res3.body.errors[0].path === 'age');
  }

  @Test()
  async verifyQuery() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<UserShape>('get', '/test/schema/user', { query: user });

    assert(res1.body.name === user.name);

    const res2 = await this.request<Errors>('get', '/test/schema/user', { query: { id: 'orange' }, throwOnError: false });

    assert(res2.status === 400);
    assert(/Validation errors have occurred/.test(res2.body.message));
    assert(res2.body.errors[0].path === 'id');

    const res3 = await this.request<Errors>('get', '/test/schema/user', { query: { id: '0', name: 'bob', age: 'a' }, throwOnError: false });

    assert(res3.status === 400);
    assert(/Validation errors have occurred/.test(res3.body.message));
    assert(res3.body.errors[0].path === 'age');
  }

  @Test()
  async verifyInterface() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<UserShape>('get', '/test/schema/interface', { query: user });

    assert(res1.body.name === user.name);
    assert(res1.body.age === 20);

    const res2 = await this.request<Errors>('get', '/test/schema/interface', { query: { id: 'orange' }, throwOnError: false });

    assert(res2.status === 400);
    assert(/Validation errors have occurred/.test(res2.body.message));
    assert(res2.body.errors[0].path === 'id');

    const res3 = await this.request<Errors>('get', '/test/schema/interface', { query: { id: '0', name: 'bob', age: 'a' }, throwOnError: false });

    assert(res3.status === 400);
    assert(/Validation errors have occurred/.test(res3.body.message));
    assert(res3.body.errors[0].path === 'age');
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
    const ep = getEndpoint('/classShape/:shape', 'get');
    assert(ep.responseType);
    assert(SchemaRegistry.has(ep.responseType!.type));
  }

  @Test()
  async verifyRenderable() {
    const ep = getEndpoint('/renderable/:age', 'get');
    assert(ep.responseType?.type === undefined);
  }

  @Test()
  async verifyCustomRenderable() {
    const ep = getEndpoint('/customRender', 'get');
    assert(ep.responseType?.type === User);
  }

  @Test()
  async verifyCustomRenderable2() {
    const ep = getEndpoint('/customRender2', 'get');
    assert(ep.responseType?.type === User);
  }
}
