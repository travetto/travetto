import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Schema, SchemaRegistry, ValidationResultError, Validator } from '@travetto/schema';
import { Controller, Post, Get, ControllerRegistry, WebResponse, PathParam, QueryParam, HttpMethod } from '@travetto/web';

import { BaseWebSuite } from './base.ts';

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

@Validator(user => {
  if (user && user.age === 300) {
    return { kind: 'value', message: 'Age cannot be 300', path: 'age' }
  }
})
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
  async ifUser(user: UserShape) {
    return user;
  }

  @Get('/interface-prefix')
  async ifUserPrefix(user: User, @QueryParam({ prefix: 'user2' }) user3: User) {
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
  async classShape(@PathParam('shape') sh: string) {
    return new SimpleUser();
  }

  @Get('/renderable/:age')
  async renderable(age: number) {
    return WebResponse.redirect('google.com');
  }

  @Get('/customSerialize')
  async customSerialize() {
    return WebResponse.from(new User());
  }

  /**
   * @returns {Promise<User>}
   */
  @Get('/customSerialize2')
  async customSerialize2() {
  }
}

function getEndpoint(path: string, method: HttpMethod) {
  return ControllerRegistry.get(SchemaAPI)
    .endpoints.find(x => x.path === path && x.method === method)!;
}

@Suite()
export abstract class SchemaWebServerSuite extends BaseWebSuite {

  @Test()
  async verifyBody() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<UserShape>({ method: 'POST', path: '/test/schema/user', body: user });

    assert(res1.source?.name === user.name);

    const res2 = await this.request<ValidationResultError>({ method: 'POST', path: '/test/schema/user', body: { id: 'orange' } }, false);

    assert(res2.statusCode === 400);
    assert(/Validation errors have occurred/.test(res2.source?.message ?? ''));
    assert(res2.source?.details.errors[0].path === 'id');

    const res3 = await this.request<ValidationResultError>({ method: 'POST', path: '/test/schema/user', body: { id: 0, name: 'bob', age: 'a' } }, false);

    assert(res3.statusCode === 400);
    assert(/Validation errors have occurred/.test(res3.source?.message ?? ''));
    assert(res3.source?.details.errors[0].path === 'age');
  }

  @Test()
  async verifyQuery() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<UserShape>({ method: 'GET', path: '/test/schema/user', query: user });

    assert(res1.source?.name === user.name);

    const res2 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/user', query: { id: 'orange' } }, false);

    assert(res2.statusCode === 400);
    assert(/Validation errors have occurred/.test(res2.source?.message ?? ''));
    assert(res2.source?.details.errors[0].path === 'id');

    const res3 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/user', query: { id: '0', name: 'bob', age: 'a' } }, false);

    assert(res3.statusCode === 400);
    assert(/Validation errors have occurred/.test(res3.source?.message ?? ''));
    assert(res3.source?.details.errors[0].path === 'age');
  }

  @Test()
  async verifyInterface() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<UserShape>({ method: 'GET', path: '/test/schema/interface', query: user });

    assert(res1.source?.name === user.name);
    assert(res1.source?.age === 20);

    const res2 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/interface', query: { id: 'orange' } }, false);

    assert(res2.statusCode === 400);
    assert(/Validation errors have occurred/.test(res2.source?.message ?? ''));
    assert(res2.source?.details.errors[0].path === 'id');

    const res3 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/interface', query: { id: '0', name: 'bob', age: 'a' } }, false);

    assert(res3.statusCode === 400);
    assert(/Validation errors have occurred/.test(res3.source?.message ?? ''));
    assert(res3.source?.details.errors[0].path === 'age');
  }

  @Test()
  async verifyPrefix() {
    const user = { id: '0', name: 'bob', age: '20', active: 'false' };

    const res1 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/interface-prefix', query: user, }, false);

    assert(res1.statusCode === 400);
    assert(/Validation errors have occurred/.test(res1.source?.message ?? ''));
    console.error(res1.source);
    assert(res1.source?.details.errors[0].path.startsWith('user2'));

    const res2 = await this.request<ValidationResultError>({ method: 'GET', path: '/test/schema/interface-prefix', query: { user3: user } }, false);

    assert(res2.statusCode === 400);
    assert(/Validation errors have occurred/.test(res2.source?.message ?? ''));
    assert(res2.source?.details.errors[0].path);
    assert(!res2.source?.details.errors[0].path.startsWith('user'));

    const res3 = await this.request<User>({ method: 'GET', path: '/test/schema/interface-prefix', query: { ...user, user2: user } });

    assert(res3.statusCode === 200);
    assert(res3.source?.name === user.name);
    assert(res3.source?.age === 20);

    const res4 = await this.request<ValidationResultError>({
      method: 'GET', path: '/test/schema/interface-prefix',
      query: { ...user, user2: { ...user, age: '300' } },
    }, false);

    assert(res4.statusCode === 400);
    assert(/Validation errors have occurred/.test(res4.source?.message ?? ''));
    assert(res4.source?.details.errors[0].path);
    assert(!res4.source?.details.errors[0].path.startsWith('user2.age'));
  }

  @Test()
  async verifyVoid() {
    const ep = getEndpoint('/void', 'GET');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyVoidAll() {
    const ep = getEndpoint('/voidAll', 'GET');
    assert(ep.responseType === undefined);
  }

  @Test()
  async verifyList() {
    const ep = getEndpoint('/users', 'GET');
    assert(ep.responseType?.type === User);
  }

  @Test()
  async verifyShapeAll() {
    const ep = getEndpoint('/allShapes', 'GET');
    console.log(`${ep.responseType}`);
  }

  @Test()
  async verifyShapeClass() {
    const ep = getEndpoint('/classShape/:shape', 'GET');
    assert(ep.responseType);
    assert(SchemaRegistry.has(ep.responseType!.type));
  }

  @Test()
  async verifyRenderable() {
    const ep = getEndpoint('/renderable/:age', 'GET');
    assert(ep.responseType?.type === undefined);
  }

  @Test()
  async verifyCustomSerializeable() {
    const ep = getEndpoint('/customSerialize', 'GET');
    assert(ep.responseType?.type === User);
  }

  @Test()
  async verifyCustomSerializeable2() {
    const ep = getEndpoint('/customSerialize2', 'GET');
    assert(ep.responseType?.type === User);
  }
}
