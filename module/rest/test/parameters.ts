import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Query, Header, Path, Context } from '../src/decorator/param';
import { Post, Get } from '../src/decorator/endpoint';
import { Controller } from '../src/decorator/controller';
import { ControllerRegistry } from '../src/registry/controller';
import { MethodOrAll, Request, Response } from '../src/types';
import { ParamUtil } from '../src/util/param';

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
  async jobOutput(@Path() jobId: string, @Query({ required: false }) time: Date) { }

  @Get('/job/output2')
  async jobOutput2(@Query({ ...OPTIONAL, name: 'optional' }) time: Date) { }

  /**
   * @param name User's name
   */
  @Post('/alias')
  async alias(@Query({ name: 'name', description: 'User name' }) nm: string = 'green') { }

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
      ParamUtil.extractParams(ep.params, {
        params: { name: 'bob' },
        query: {
          age: '20'
        }
      } as any, {} as any)
    );

    assert.throws(() => {
      ParamUtil.extractParams(ep.params, {
        params: { name: 'bob' },
        query: {
          age: 'blue'
        }
      } as any, {} as any);
    });
  }

  @Test()
  async testHeaders() {
    const ep = ParameterTest.getEndpoint('/login', 'post');

    assert.doesNotThrow(() =>
      ParamUtil.extractParams(ep.params, {
        header: (key: string) => key
      } as any, {} as any)
    );

    assert.throws(() => {
      ParamUtil.extractParams(ep.params, {
        header: (key: string) => { }
      } as any, {} as any);
    });

  }

  @Test()
  async testOptional() {
    const ep = ParameterTest.getEndpoint('/user/:id', 'post');

    assert.doesNotThrow(() =>
      ParamUtil.extractParams(ep.params, {
        query: {},
        params: { id: '5' }
      } as any, {} as any)
    );

    assert.throws(() =>
      ParamUtil.extractParams(ep.params, {
        query: { age: 'blue' },
        params: { id: '5' }
      } as any, {} as any), 'Incorrect type'
    );

    assert.throws(() =>
      ParamUtil.extractParams(ep.params, {
        params: {}, query: {}
      } as any, {} as any), /Missing.*\bid/i
    );
  }

  @Test()
  async testReqRes() {
    const ep = ParameterTest.getEndpoint('/req/res', 'post');
    const req = { path: '/path' };
    const res = { status: 200 };
    const items = ParamUtil.extractParams(ep.params, req as any, res as any);

    assert(req === items[0]);
    assert(res === items[1]);
    assert(req === items[2]);
  }

  @Test()
  async testAliasing() {
    const ep = ParameterTest.getEndpoint('/alias', 'post');
    assert(ep.params[0].description === 'User name');
    assert(ParamUtil.extractParams(ep.params, { query: { nm: 'blue' } } as any, {} as any) === ['green']);
    assert(ParamUtil.extractParams(ep.params, { query: { name: 'blue' } } as any, {} as any) === ['blue']);

    const ep2 = ParameterTest.getEndpoint('/alias2', 'post');
    assert(ep2.params[0].description === 'User\'s name');
    assert(ep2.params[0].name === 'nm');
    assert(ep2.params[0].type === String);

    const ep3 = ParameterTest.getEndpoint('/alias3', 'post');
    assert(ep3.params[0].description === 'User\'s name');
    assert(ep3.params[0].name === 'nm');
    assert(ep3.params[0].type === Object);
  }

  @Test()
  async testArray() {
    const ep = ParameterTest.getEndpoint('/array', 'post');
    const ep2 = ParameterTest.getEndpoint('/array2', 'post');

    assert(ParamUtil.extractParams(ep2.params, { query: { values: 'no' } } as any, {} as any) === [[false]]);
    assert(ParamUtil.extractParams(ep2.params, { query: { values: ['no', 'yes'] } } as any, {} as any) === [[false, true]]);

    assert(ParamUtil.extractParams(ep.params, { query: { values: '0' } } as any, {} as any) === [[0]]);
    assert(ParamUtil.extractParams(ep.params, { query: { values: ['5', '3'] } } as any, {} as any) === [[5, 3]]);
  }

  @Test()
  async realWorld() {
    const ep = ParameterTest.getEndpoint('/job/output/:jobId', 'get');
    assert.doesNotThrow(() => ParamUtil.extractParams(ep.params, { params: { jobId: '5' }, query: {} } as any, {} as any));
    assert.throws(() => ParamUtil.extractParams(ep.params, { params: {}, query: {} } as any, {} as any), /missing path/i);
    assert.throws(() => ParamUtil.extractParams(ep.params, { params: { jobId: '5' }, query: { time: 'blue' } } as any, {} as any), 'Incorrect type');
  }
}