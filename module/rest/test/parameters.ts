import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Describe, Required, SchemaRegistry, ValidationResultError } from '@travetto/schema';

import { Query, Header, Path, Context } from '../src/decorator/param';
import { Post, Get } from '../src/decorator/endpoint';
import { Controller } from '../src/decorator/controller';
import { ControllerRegistry } from '../src/registry/controller';
import { MethodOrAll, Request, Response } from '../src/types';
import { ParamExtractor } from '../src/util/param';

interface Wrapper<T> {
  items: T[];
}

const OPTIONAL = { required: false };

interface Complex { }

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

  @Post('/array2')
  async array2(...values: boolean[]) { }

  @Get('/job/output/:jobId')
  async jobOutput(@Path() jobId: string, @Required(false) @Query() time: Date) { }

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
    assert.doesNotThrow(() =>
      ParamExtractor.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: '20'
        }
      } as unknown as Request, {} as Response)
    );

    assert.throws(() => {
      ParamExtractor.extract(ep, {
        params: { name: 'bob' },
        query: {
          age: 'blue'
        }
      } as unknown as Request, {} as Response);
    });
  }

  @Test()
  async testHeaders() {
    const ep = ParameterTest.getEndpoint('/login', 'post');

    assert.doesNotThrow(() =>
      ParamExtractor.extract(ep, {
        header: (key: string) => key
      } as unknown as Request, {} as Response)
    );

    assert.throws(() => {
      ParamExtractor.extract(ep, {
        header: (key: string) => { }
      } as unknown as Request, {} as Response);
    });

  }

  @Test()
  async testOptional() {
    const ep = ParameterTest.getEndpoint('/user/:id', 'post');

    assert.doesNotThrow(() =>
      ParamExtractor.extract(ep, {
        query: {},
        params: { id: '5' }
      } as unknown as Request, {} as Response)
    );

    assert.throws(() =>
      ParamExtractor.extract(ep, {
        query: { age: 'blue' },
        params: { id: '5' }
      } as unknown as Request, {} as Response), ValidationResultError
    );

    assert.throws(() =>
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
    const items = ParamExtractor.extract(ep, req as unknown as Request, res as unknown as Response);

    assert(req === items[0]);
    assert(res === items[1]);
    assert(req === items[2]);
  }

  @Test()
  async testAliasing() {
    const ep = ParameterTest.getEndpoint('/alias', 'post');
    const params = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    assert(params[0].description === 'User name');
    assert.deepStrictEqual(ParamExtractor.extract(ep, { query: { nm: 'blue' } } as unknown as Request, {} as Response), ['green']);
    assert.deepStrictEqual(ParamExtractor.extract(ep, { query: { name: 'blue' } } as unknown as Request, {} as Response), ['blue']);

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

    assert.deepStrictEqual(ParamExtractor.extract(ep2, { query: { values: 'no' } } as unknown as Request, {} as Response), [[false]]);
    assert.deepStrictEqual(ParamExtractor.extract(ep2, { query: { values: ['no', 'yes'] } } as unknown as Request, {} as Response), [[false, true]]);

    assert.deepStrictEqual(ParamExtractor.extract(ep, { query: { values: '0' } } as unknown as Request, {} as Response), [[0]]);
    assert.deepStrictEqual(ParamExtractor.extract(ep, { query: { values: ['5', '3'] } } as unknown as Request, {} as Response), [[5, 3]]);
  }

  @Test()
  async realWorld() {
    const ep = ParameterTest.getEndpoint('/job/output/:jobId', 'get');
    assert.doesNotThrow(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: {} } as unknown as Request, {} as Response));
    assert.throws(() => ParamExtractor.extract(ep, { params: {}, query: {} } as unknown as Request, {} as Response), ValidationResultError);
    assert.throws(() => ParamExtractor.extract(ep, { params: { jobId: '5' }, query: { time: 'blue' } } as unknown as Request, {} as Response), ValidationResultError);
  }
}