import assert from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Describe, Min, Required, SchemaRegistry, ValidationResultError } from '@travetto/schema';

import { Query, Header, Path, Context } from '../src/decorator/param';
import { Post, Get } from '../src/decorator/endpoint';
import { Controller } from '../src/decorator/controller';
import { ControllerRegistry } from '../src/registry/controller';
import { MethodOrAll, Request, Response } from '../src/types';
import { ParamExtractor } from '../src/util/param';

class User {
  name: string;
}

@Controller('/')
class ParamController {
  @Post('/:name')
  async endpoint(@Path() name: string, @Query() age: number) { }

  @Post('/login')
  async login(@Header('api-key') key: string) { }

  @Post('/user/:id')
  async users(@Path() id: string, @Query() age?: number) { }

  @Post('/req/res')
  async reqRes(@Context() req: Request, @Context() res: Response, req2?: Request) { }

  @Post('/array')
  async array(values: number[]) { }

  @Get('/array/names')
  async arrayNames(values?: string[]) { }

  @Post('/array2')
  async array2(...values: boolean[]) { }

  @Get('/job/output/:jobId')
  async jobOutput(@Path() jobId: string, @Required(false) @Query() time: Date) { }

  @Get('/job/output-min/:jobId')
  async jobOutputMin(@Path() jobId: string, @Min(10).Param @Query() age: number) { }

  @Get('/job/output2')
  async jobOutput2(@Query({ name: 'optional' }) time?: Date) { }

  /**
   * @param name User name
   */
  @Post('/alias')
  async alias(@Describe({ description: 'User name' }) @Query({ name: 'name' }) nm: string = 'green') { }

  /**
   * @param nm User's name
   */
  @Post('/alias2')
  async alias2(@Query() nm: string = 'green') { }

  /**
  * @param nm User's name
  */
  @Post('/alias3')
  async alias3(@Query() nm: string | number = 'green') { }

  /**
  */
  // @Post('/wrapper')
  // async wrapper(@Body() wrapper: Wrapper<Complex>) { }

  @Get('/list/todo')
  async listTodo(limit: number, offset: number, categories?: string[]): Promise<unknown[]> {
    return [];
  }

  @Get('/interface-prefix')
  async ifUserPrefix(user3: User, @Query({ prefix: 'user1' }) user2: User) {
    return user2;
  }
}

@Suite()
export class ParameterTest {
  static getEndpoint(path: string, method: MethodOrAll) {
    return ControllerRegistry.get(ParamController).endpoints.find(x => x.path === path && x.method === method)!;
  }

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async simpleParameters() {
    const ep = ParameterTest.getEndpoint('/:name', 'post');
    await assert.doesNotReject(() =>
      ParamExtractor.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: '20'
        }
      } as unknown as Request, {} as Response)
    );

    await assert.rejects(() =>
      ParamExtractor.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: 'blue'
        }
      } as unknown as Request, {} as Response)
    );
  }

  @Test()
  async testHeaders() {
    const ep = ParameterTest.getEndpoint('/login', 'post');

    await assert.doesNotReject(() =>
      ParamExtractor.extract(ep, {
        header: (key: string) => key
      } as unknown as Request, {} as Response)
    );

    await assert.rejects(() =>
      ParamExtractor.extract(ep, {
        header: (key: string) => { }
      } as unknown as Request, {} as Response)
    );

  }

  @Test()
  async testOptional() {
    const ep = ParameterTest.getEndpoint('/user/:id', 'post');

    await assert.doesNotReject(() =>
      ParamExtractor.extract(ep, {
        query: {},
        params: { id: '5' }
      } as unknown as Request, {} as Response)
    );

    await assert.rejects(() =>
      ParamExtractor.extract(ep, {
        query: { age: 'blue' },
        params: { id: '5' }
      } as unknown as Request, {} as Response), ValidationResultError
    );

    await assert.rejects(() =>
      ParamExtractor.extract(ep, {
        params: {}, query: {}
      } as unknown as Request, {} as Response), ValidationResultError
    );
  }

  @Test()
  async testReqRes() {
    const ep = ParameterTest.getEndpoint('/req/res', 'post');
    const req = { path: '/path' };
    const res = { status: 200 };
    const items = await ParamExtractor.extract(ep, req as unknown as Request, res as unknown as Response);

    assert(req === items[0]);
    assert(res === items[1]);
    assert(req === items[2]);
  }

  @Test()
  async testAliasing() {
    const ep = ParameterTest.getEndpoint('/alias', 'post');
    const params = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    assert(params[0].description === 'User name');
    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { nm: 'blue' } } as unknown as Request, {} as Response), ['green']);
    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { name: 'blue' } } as unknown as Request, {} as Response), ['blue']);

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

    assert.deepStrictEqual(await ParamExtractor.extract(ep2, { query: { values: 'no' } } as unknown as Request, {} as Response), [[false]]);
    assert.deepStrictEqual(await ParamExtractor.extract(ep2, { query: { values: ['no', 'yes'] } } as unknown as Request, {} as Response), [[false, true]]);

    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { values: '0' } } as unknown as Request, {} as Response), [[0]]);
    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { values: ['5', '3'] } } as unknown as Request, {} as Response), [[5, 3]]);
  }

  @Test()
  async realWorld() {
    const ep = ParameterTest.getEndpoint('/job/output/:jobId', 'get');
    await assert.doesNotReject(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: {} } as unknown as Request, {} as Response));
    await assert.rejects(() => ParamExtractor.extract(ep, { params: {}, query: {} } as unknown as Request, {} as Response), ValidationResultError);
    await assert.rejects(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: { time: 'blue' } } as unknown as Request, {} as Response), ValidationResultError);
  }

  @Test()
  async realWorldMin() {
    const ep = ParameterTest.getEndpoint('/job/output-min/:jobId', 'get');
    await assert.doesNotReject(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: { age: '20' } } as unknown as Request, {} as Response));
    await assert.rejects(() => ParamExtractor.extract(ep, { params: {}, query: {} } as unknown as Request, {} as Response), ValidationResultError);
    await assert.rejects(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: { age: 'blue' } } as unknown as Request, {} as Response), ValidationResultError);
    await assert.rejects(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: { age: 9 } } as unknown as Request, {} as Response), ValidationResultError);
  }


  @Test()
  async realWorldQueryArrayOptional() {
    const ep = ParameterTest.getEndpoint('/array/names', 'get');
    await assert.doesNotReject(() => ParamExtractor.extract(ep, { query: {} } as unknown as Request, {} as Response));

    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { values: 'no' } } as unknown as Request, {} as Response), [['no']]);

    assert.deepStrictEqual(await ParamExtractor.extract(ep, { query: { values: [1, 2, 3] } } as unknown as Request, {} as Response), [['1', '2', '3']]);
  }

  @Test()
  async realWorldListTodo() {
    const ep = ParameterTest.getEndpoint('/list/todo', 'get');
    await assert.rejects(() => ParamExtractor.extract(ep, { query: {} } as unknown as Request, {} as Response));

    assert.deepStrictEqual(
      await ParamExtractor.extract(
        ep,
        { query: { limit: 1, offset: 0, categories: [1, 2, 3] } } as unknown as Request, {} as Response
      ),
      [1, 0, ['1', '2', '3']]
    );

    assert.deepStrictEqual(
      await ParamExtractor.extract(
        ep,
        { query: { limit: 1, offset: 0, categories: [] } } as unknown as Request, {} as Response),
      [1, 0, []]
    );

    assert.deepStrictEqual(
      await ParamExtractor.extract(
        ep,
        { query: { limit: 1, offset: 0 } } as unknown as Request, {} as Response),
      [1, 0, undefined]
    );
  }

  @Test()
  async realWorldUserInterface() {
    await RootRegistry.init();

    const ep = ParameterTest.getEndpoint('/interface-prefix', 'get');
    await assert.rejects(() => ParamExtractor.extract(
      ep,
      { query: {} } as unknown as Request,
      {} as Response)
    );

    const extracted = await ParamExtractor.extract(
      ep,
      { query: { user1: { name: 'bob' }, name: 'rob' } } as unknown as Request, {} as Response
    );

    // @ts-expect-error
    assert(extracted[0]?.name === 'rob');
    // @ts-expect-error
    assert(extracted[1]?.name === 'bob');
  }
}