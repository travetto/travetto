import assert from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Describe, Min, Required, SchemaRegistry, ValidationResultError } from '@travetto/schema';
import { asFull, castTo } from '@travetto/runtime';

import { QueryParam, HeaderParam, PathParam, ContextParam } from '../src/decorator/param.ts';
import { Post, Get } from '../src/decorator/endpoint.ts';
import { Controller } from '../src/decorator/controller.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';
import { MethodOrAll, Request, Response } from '../src/types.ts';
import { ParamExtractor } from '../src/util/param.ts';
import { EndpointConfig } from '../__index__.ts';

class User {
  name: string;
}

@Controller('/')
class ParamController {
  @Post('/:name')
  async endpoint(@PathParam() name: string, @QueryParam() age: number) { }

  @Post('/login')
  async login(@HeaderParam('api-key') key: string) { }

  @Post('/user/:id')
  async users(@PathParam() id: string, @QueryParam() age?: number) { }

  @Post('/req/res')
  async reqRes(@ContextParam() req: Request, @ContextParam() res: Response, req2?: Request) { }

  @Post('/array')
  async array(values: number[]) { }

  @Get('/array/names')
  async arrayNames(values?: string[]) { }

  @Post('/array2')
  async array2(...values: boolean[]) { }

  @Get('/job/output/:jobId')
  async jobOutput(@PathParam() jobId: string, @Required(false) @QueryParam() time: Date) { }

  @Get('/job/output-min/:jobId')
  async jobOutputMin(@PathParam() jobId: string, @Min(10) @QueryParam() age: number) { }

  @Get('/job/output2')
  async jobOutput2(@QueryParam({ name: 'optional' }) time?: Date) { }

  /**
   * @param name User name
   */
  @Post('/alias')
  async alias(@Describe({ description: 'User name' }) @QueryParam({ name: 'name' }) nm: string = 'green') { }

  /**
   * @param nm User's name
   */
  @Post('/alias2')
  async alias2(@QueryParam() nm: string = 'green') { }

  /**
  * @param nm User's name
  */
  @Post('/alias3')
  async alias3(@QueryParam() nm: string | number = 'green') { }

  /**
  */
  // @Post('/wrapper')
  // async wrapper(@Body() wrapper: Wrapper<Complex>) { }

  @Get('/list/todo')
  async listTodo(limit: number, offset: number, categories?: string[]): Promise<unknown[]> {
    return [];
  }

  @Get('/interface-prefix')
  async ifUserPrefix(user3: User, @QueryParam({ prefix: 'user1' }) user2: User) {
    return user2;
  }
}

@Suite()
export class ParameterTest {
  static getEndpoint(path: string, method: MethodOrAll) {
    return ControllerRegistry.get(ParamController).endpoints.find(x => x.path === path && x.method === method)!;
  }

  static async extract(ep: EndpointConfig, req: Partial<Request>, res: Partial<Response> = {}): Promise<unknown[]> {
    return await ParamExtractor.extract(ep, asFull(req), asFull(res));
  }

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async simpleParameters() {
    const ep = ParameterTest.getEndpoint('/:name', 'post');
    await assert.doesNotReject(() =>
      ParameterTest.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: '20'
        }
      })
    );

    await assert.rejects(() =>
      ParameterTest.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: 'blue'
        }
      })
    );
  }

  @Test()
  async testHeaders() {
    const ep = ParameterTest.getEndpoint('/login', 'post');

    await assert.doesNotReject(() =>
      ParameterTest.extract(ep, {
        header: castTo((key: string): string => key)
      })
    );

    await assert.rejects(() =>
      ParameterTest.extract(ep, {
        header: castTo(() => { })
      })
    );

  }

  @Test()
  async testOptional() {
    const ep = ParameterTest.getEndpoint('/user/:id', 'post');

    await assert.doesNotReject(() =>
      ParameterTest.extract(ep, {
        query: {},
        params: { id: '5' }
      })
    );

    await assert.rejects(() =>
      ParameterTest.extract(ep, {
        query: { age: 'blue' },
        params: { id: '5' }
      }), ValidationResultError
    );

    await assert.rejects(() =>
      ParameterTest.extract(ep, {
        params: {}, query: {}
      }), ValidationResultError
    );
  }

  @Test()
  async testReqRes() {
    const ep = ParameterTest.getEndpoint('/req/res', 'post');
    const req = { path: '/path' };
    const res = { statusCode: 200 };
    const items = await ParameterTest.extract(ep, req, res);

    assert(req === items[0]);
    assert(res === items[1]);
    assert(req === items[2]);
  }

  @Test()
  async testAliasing() {
    const ep = ParameterTest.getEndpoint('/alias', 'post');
    const params = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    assert(params[0].description === 'User name');
    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { nm: 'blue' } }), ['green']);
    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { name: 'blue' } }), ['blue']);

    const ep2 = ParameterTest.getEndpoint('/alias2', 'post');
    const params2 = SchemaRegistry.getMethodSchema(ep2.class, ep2.handlerName);
    assert(params2[0].description === 'User\'s name');
    assert(ep2.params[0].name === 'nm');

    const ep3 = ParameterTest.getEndpoint('/alias3', 'post');
    const params3 = SchemaRegistry.getMethodSchema(ep3.class, ep3.handlerName);
    assert(params3[0].description === 'User\'s name');
    assert(ep3.params[0].name === 'nm');
  }

  @Test()
  async testArray() {
    const ep = ParameterTest.getEndpoint('/array', 'post');
    const ep2 = ParameterTest.getEndpoint('/array2', 'post');

    assert.deepStrictEqual(await ParameterTest.extract(ep2, { query: { values: 'no' } }), [[false]]);
    assert.deepStrictEqual(await ParameterTest.extract(ep2, { query: { values: ['no', 'yes'] } }), [[false, true]]);

    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { values: '0' } }), [[0]]);
    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { values: ['5', '3'] } }), [[5, 3]]);
  }

  @Test()
  async realWorld() {
    const ep = ParameterTest.getEndpoint('/job/output/:jobId', 'get');
    await assert.doesNotReject(() => ParameterTest.extract(ep, { params: { jobId: '5' }, query: {} }));
    await assert.rejects(() => ParameterTest.extract(ep, { params: {}, query: {} }), ValidationResultError);
    await assert.rejects(() => ParameterTest.extract(ep, { params: { jobId: '5' }, query: { time: 'blue' } }), ValidationResultError);
  }

  @Test()
  async realWorldMin() {
    const ep = ParameterTest.getEndpoint('/job/output-min/:jobId', 'get');
    await assert.doesNotReject(() => ParameterTest.extract(ep, { params: { jobId: '5' }, query: { age: '20' } }));
    await assert.rejects(() => ParameterTest.extract(ep, { params: {}, query: {} }), ValidationResultError);
    await assert.rejects(() => ParameterTest.extract(ep, { params: { jobId: '5' }, query: { age: 'blue' } }), ValidationResultError);
    await assert.rejects(() => ParameterTest.extract(ep, { params: { jobId: '5' }, query: { age: 9 } }), ValidationResultError);
  }

  @Test()
  async realWorldQueryArrayOptional() {
    const ep = ParameterTest.getEndpoint('/array/names', 'get');
    await assert.doesNotReject(() => ParameterTest.extract(ep, { query: {} }));

    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { values: 'no' } }), [['no']]);

    assert.deepStrictEqual(await ParameterTest.extract(ep, { query: { values: [1, 2, 3] } }), [['1', '2', '3']]);
  }

  @Test()
  async realWorldListTodo() {
    const ep = ParameterTest.getEndpoint('/list/todo', 'get');
    await assert.rejects(() => ParameterTest.extract(ep, { query: {} }));

    assert.deepStrictEqual(
      await ParameterTest.extract(
        ep,
        { query: { limit: 1, offset: 0, categories: [1, 2, 3] } }
      ),
      [1, 0, ['1', '2', '3']]
    );

    assert.deepStrictEqual(
      await ParameterTest.extract(
        ep,
        { query: { limit: 1, offset: 0, categories: [] } }),
      [1, 0, []]
    );

    assert.deepStrictEqual(
      await ParameterTest.extract(
        ep,
        { query: { limit: 1, offset: 0 } }
      ),
      [1, 0, undefined]
    );
  }

  @Test()
  async realWorldUserInterface() {
    await RootRegistry.init();

    const ep = ParameterTest.getEndpoint('/interface-prefix', 'get');
    await assert.rejects(() => ParameterTest.extract(ep, { query: {} }));

    const extracted = await ParameterTest.extract(
      ep,
      { query: { user1: { name: 'bob' }, name: 'rob' } }
    );

    // @ts-expect-error
    assert(extracted[0]?.name === 'rob');
    // @ts-expect-error
    assert(extracted[1]?.name === 'bob');
  }
}