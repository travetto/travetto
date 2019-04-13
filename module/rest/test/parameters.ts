import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Query, Header, Body, Param, Path } from '../src/decorator/param';
import { Post } from '../src/decorator/endpoint';
import { Controller } from '../src/decorator/controller';
import { RouteUtil } from '../src/util/route';
import { ControllerRegistry } from '../src/registry/registry';
import { Method } from '../src/types';

@Controller('/')
class ParamController {
  @Post('/:name')
  async endpoint(@Path() name: string, @Query() age: number) { }

  @Post('/login')
  async login(@Header('api-key') key: string) { }

  @Post('/user/:id')
  async users(@Path() id: string, @Query() age?: number) { }

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
  async tetOptional() {
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
}