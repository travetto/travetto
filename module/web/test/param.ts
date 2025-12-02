import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Alias, Min, Required, SchemaRegistryIndex, ValidationResultError } from '@travetto/schema';
import {
  ContextParam, Controller, ControllerRegistryIndex, EndpointConfig, EndpointUtil,
  Get, HeaderParam, HttpMethod, PathParam, Post, QueryParam, WebHeaders, WebRequest
} from '@travetto/web';

class User {
  name: string;
}

@Controller('/')
class ParamController {

  @ContextParam()
  request: WebRequest;

  @Post('/:name')
  async endpoint(@PathParam() name: string, @QueryParam() age: number) { }

  @Post('/login')
  async login(@HeaderParam('api-key') key: string) { }

  @Post('/user/:id')
  async users(@PathParam() id: string, @QueryParam() age?: number) { }

  @Post('/req/res')
  async reqRes() {
    return this.request.context.path;
  }

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
  async jobOutput2(@Alias('optional') time?: Date) { }

  /**
   * @param nm User name
   */
  @Post('/alias')
  async alias(@Alias('name') nm: string = 'green') { }

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
export class EndpointParameterTest {
  static getEndpoint(path: string, method: HttpMethod) {
    return ControllerRegistryIndex.getConfig(ParamController).endpoints.find(x => x.path === path && x.httpMethod === method)!;
  }

  static async extract(ep: EndpointConfig, request: Partial<WebRequest>): Promise<unknown[]> {
    return await EndpointUtil.extractParameters(ep, new WebRequest({ ...request }));
  }

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async simpleParameters() {
    const ep = EndpointParameterTest.getEndpoint('/:name', 'POST');
    await assert.doesNotReject(() =>
      EndpointParameterTest.extract(ep, {
        context: {
          path: '/:name',
          pathParams: { name: 'bob' },
          httpQuery: {
            age: '20'
          }
        },
      })
    );

    await assert.rejects(() =>
      EndpointParameterTest.extract(ep, {
        context: {
          path: '/:name',
          pathParams: { name: 'bob' },
          httpQuery: {
            age: 'blue'
          }
        }
      })
    );
  }

  @Test()
  async testHeaders() {
    const ep = EndpointParameterTest.getEndpoint('/login', 'POST');

    await assert.doesNotReject(() =>
      EndpointParameterTest.extract(ep, {
        headers: new WebHeaders({
          'api-key': 'api-key'
        })
      })
    );

    await assert.rejects(() =>
      EndpointParameterTest.extract(ep, {})
    );
  }

  @Test()
  async testOptional() {
    const ep = EndpointParameterTest.getEndpoint('/user/:id', 'POST');

    await assert.doesNotReject(() =>
      EndpointParameterTest.extract(ep, {
        context: {
          path: '/user/:id',
          pathParams: { id: '5' }
        }
      })
    );

    await assert.rejects(() =>
      EndpointParameterTest.extract(ep, {
        context: {
          path: '/user/:id',
          httpQuery: { age: 'blue' },
          pathParams: { id: '5' }
        }
      }), ValidationResultError
    );

    await assert.rejects(() =>
      EndpointParameterTest.extract(ep, {}), ValidationResultError
    );
  }

  @Test()
  async testReqRes() {
    const ep = EndpointParameterTest.getEndpoint('/req/res', 'POST');
    const req = { context: { path: '/path' } };
    const items = await EndpointParameterTest.extract(ep, req);

    assert(items.length === 0);
  }

  @Test()
  async testAliasing() {
    const ep = EndpointParameterTest.getEndpoint('/alias', 'POST');
    const { parameters: params } = SchemaRegistryIndex.get(ep.class).getMethod(ep.methodName);
    assert(params[0].description === 'User name');
    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/alias',
        httpQuery: { nm: 'blue' }
      }
    }), ['blue']);
    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/alias',
        httpQuery: { name: 'blue' }
      }
    }), ['blue']);

    const ep2 = EndpointParameterTest.getEndpoint('/alias2', 'POST');
    const { parameters: params2 } = SchemaRegistryIndex.get(ep2.class).getMethod(ep2.methodName);
    assert(params2[0].description === 'User\'s name');
    assert(params2[0].name === 'nm');

    const ep3 = EndpointParameterTest.getEndpoint('/alias3', 'POST');
    const { parameters: params3 } = SchemaRegistryIndex.get(ep3.class).getMethod(ep3.methodName);
    assert(params3[0].description === 'User\'s name');
    assert(params3[0].name === 'nm');
  }

  @Test()
  async testArray() {
    const ep = EndpointParameterTest.getEndpoint('/array', 'POST');
    const ep2 = EndpointParameterTest.getEndpoint('/array2', 'POST');

    assert.deepStrictEqual(await EndpointParameterTest.extract(ep2, {
      context: {
        path: '/array',
        httpQuery: { values: 'no' }
      }
    }), [[false]]);
    assert.deepStrictEqual(await EndpointParameterTest.extract(ep2, {
      context: {
        path: '/array2',
        httpQuery: { values: ['no', 'yes'] }
      }
    }), [[false, true]]);

    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/array',
        httpQuery: { values: '0' }
      }
    }), [[0]]);
    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/array',
        httpQuery: { values: ['5', '3'] }
      }
    }), [[5, 3]]);
  }

  @Test()
  async realWorld() {
    const ep = EndpointParameterTest.getEndpoint('/job/output/:jobId', 'GET');
    await assert.doesNotReject(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output/:jobId', pathParams: { jobId: '5' }
      }
    }));
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output/:jobId'
      }
    }), ValidationResultError);
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output/:jobId',
        pathParams: { jobId: '5' },
        httpQuery: { time: 'blue' }
      }
    }), ValidationResultError);
  }

  @Test()
  async realWorldMin() {
    const ep = EndpointParameterTest.getEndpoint('/job/output-min/:jobId', 'GET');
    await assert.doesNotReject(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output-min/:jobId',
        pathParams: { jobId: '5' }, httpQuery: { age: '20' }
      }
    }));
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output-min/:jobId'
      }
    }), ValidationResultError);
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output-min/:jobId',
        pathParams: { jobId: '5' }, httpQuery: { age: 'blue' }
      }
    }), ValidationResultError);
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/job/output-min/:jobId',
        pathParams: { jobId: '5' }, httpQuery: { age: 9 }
      }
    }), ValidationResultError);
  }

  @Test()
  async realWorldQueryArrayOptional() {
    const ep = EndpointParameterTest.getEndpoint('/array/names', 'GET');
    await assert.doesNotReject(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/array/names',
      }
    }));

    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/array/names',
        httpQuery: { values: 'no' }
      }
    }), [['no']]);

    assert.deepStrictEqual(await EndpointParameterTest.extract(ep, {
      context: {
        path: '/array/names',
        httpQuery: { values: [1, 2, 3] }
      }
    }), [['1', '2', '3']]);
  }

  @Test()
  async realWorldListTodo() {
    const ep = EndpointParameterTest.getEndpoint('/list/todo', 'GET');
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/list/todo',
      }
    }));

    assert.deepStrictEqual(
      await EndpointParameterTest.extract(
        ep,
        {
          context: {
            path: '/list/todo',
            httpQuery: { limit: 1, offset: 0, categories: [1, 2, 3] }
          }
        }
      ),
      [1, 0, ['1', '2', '3']]
    );

    assert.deepStrictEqual(
      await EndpointParameterTest.extract(
        ep,
        {
          context: {
            path: '/list/todo',
            httpQuery: { limit: 1, offset: 0, categories: [] }
          }
        }
      ),
      [1, 0, []]
    );

    assert.deepStrictEqual(
      await EndpointParameterTest.extract(
        ep,
        {
          context: {
            path: '/list/todo',
            httpQuery: { limit: 1, offset: 0 }
          }
        }
      ),
      [1, 0, undefined]
    );
  }

  @Test()
  async realWorldUserInterface() {
    const ep = EndpointParameterTest.getEndpoint('/interface-prefix', 'GET');
    await assert.rejects(() => EndpointParameterTest.extract(ep, {
      context: {
        path: '/interface-prefix'
      }
    }));

    const extracted = await EndpointParameterTest.extract(
      ep,
      {
        context: {
          path: '/interface-prefix',
          httpQuery: { user1: { name: 'bob' }, name: 'rob' }
        }
      }
    );

    // @ts-expect-error
    assert(extracted[0]?.name === 'rob');
    // @ts-expect-error
    assert(extracted[1]?.name === 'bob');
  }
}