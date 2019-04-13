import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Query, Header, Body, Param, Path } from '../src/decorator/param';
import { Post } from '../src/decorator/endpoint';
import { Controller } from '../src/decorator/controller';
import { RouteUtil } from '../src/util/route';
import { ControllerRegistry } from '../src/registry/registry';
import { Method, Request, Response } from '../src/types';

@Controller('/')
class ParamController {
  @Post('/:name')
  async endpoint(@Path() name: string, @Query() age: number) { }

  @Post('/login')
  async login(@Header('api-key') key: string) { }

  @Post('/user/:id')
  async users(@Path() id: string, @Query() age?: number) { }

  @Post('/req/res')
  async reqRes(req: Request, res: Response, req2?: Request) { }

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
}

@Suite()
export class ParameterTest {
  static getEndpoint(path: string, method: Method) {
    return ControllerRegistry.get(ParamController).endpoints.find(x => x.path === path && x.method === method)!;
  }

  @BeforeAll()
  async init() {
    await ControllerRegistry.init();
  }

  @Test()
  async simpleParameters() {
    const ep = ParameterTest.getEndpoint('/:name', 'post');
    assert.doesNotThrow(() =>
      RouteUtil.computeRouteParams(ep.params, {
        params: { name: 'bob' },
        query: {
          age: '20'
        }
      } as any, {} as any)
    );

    assert.throws(() => {
      RouteUtil.computeRouteParams(ep.params, {
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
      RouteUtil.computeRouteParams(ep.params, {
        header: (key: string) => {
          return key;
        }
      } as any, {} as any)
    );

    assert.throws(() =>
      RouteUtil.computeRouteParams(ep.params, {
        header: (key: string) => { }
      } as any, {} as any)
    );

  }

  @Test()
  async testOptional() {
    const ep = ParameterTest.getEndpoint('/user/:id', 'post');

    assert.doesNotThrow(() =>
      RouteUtil.computeRouteParams(ep.params, {
        query: {},
        params: { id: '5' }
      } as any, {} as any)
    );

    assert.throws(() =>
      RouteUtil.computeRouteParams(ep.params, {
        query: { age: 'blue' },
        params: { id: '5' }
      } as any, {} as any), 'Incorrect type'
    );

    assert.throws(() =>
      RouteUtil.computeRouteParams(ep.params, {
        params: {}, query: {}
      } as any, {} as any), /Missing.*\bid/i
    );
  }

  @Test()
  async testReqRes() {
    const ep = ParameterTest.getEndpoint('/req/res', 'post');
    const req = { path: '/path' };
    const res = { status: 200 };
    const items = RouteUtil.computeRouteParams(ep.params, req as any, res as any);

    assert(req === items[0]);
    assert(res === items[1]);
    assert(req === items[2]);
  }

  @Test()
  async testAliasing() {
    const ep = ParameterTest.getEndpoint('/alias', 'post');
    assert(ep.params[0].description === 'User name');
    assert(RouteUtil.computeRouteParams(ep.params, { query: { nm: 'blue' } } as any, {} as any) === ['green']);
    assert(RouteUtil.computeRouteParams(ep.params, { query: { name: 'blue' } } as any, {} as any) === ['blue']);

    const ep2 = ParameterTest.getEndpoint('/alias2', 'post');
    assert(ep2.params[0].description === 'User\'s name');
    assert(ep2.params[0].name === 'nm');
    assert(ep2.params[0].type === String);

    const ep3 = ParameterTest.getEndpoint('/alias3', 'post');
    assert(ep3.params[0].description === 'User\'s name');
    assert(ep3.params[0].name === 'nm');
    assert(ep3.params[0].type === Object);
  }
}