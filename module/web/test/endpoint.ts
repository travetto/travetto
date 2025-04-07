import assert from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { Post, Get } from '../src/decorator/endpoint.ts';
import { Controller } from '../src/decorator/controller.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';
import { EndpointUtil } from '../src/util/endpoint.ts';

@Controller('/')
class EndpointController {
  @Post('/:name')
  async endpoint() { }

  @Post('/login')
  async login() { }

  @Post('/user/:id')
  async users() { }

  @Post('/req/res')
  async reqRes() { }

  @Post('/array')
  async array() { }

  @Get('/array/names')
  async arrayNames() { }

  @Post('/array2')
  async array2() { }

  @Get('/job/output/:jobId')
  async jobOutput() { }

  @Get('/job/:output/jobId')
  async jobOutput4() { }

  @Get('/job/output-min/:jobId')
  async jobOutputMin() { }

  @Get('/job/output/extra')
  async jobOutput3() { }

  @Get('/job/output2')
  async jobOutput2() { }

  @Get('/user/bob')
  async getBob() { }

  @Post('/alias')
  async alias() { }

  @Get('/list/todo')
  async listTodo() { }

  @Get('/a/b/c')
  async abc() { }

  @Get('/a/*')
  async wildcard() { }
}

@Suite()
export class RouterUtilTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async testOrder() {
    const controller = ControllerRegistry.get(EndpointController);
    const endpoints = EndpointUtil.orderEndpoints(controller.endpoints);

    assert.deepStrictEqual(endpoints.map(x => x.path), [
      '/a/b/c',
      '/job/output/extra',
      '/job/output-min/:jobId',
      '/job/output/:jobId',
      '/job/:output/jobId',
      '/array/names',
      '/job/output2',
      '/list/todo',
      '/req/res',
      '/user/bob',
      '/user/:id',
      '/a/*',
      '/alias',
      '/array',
      '/array2',
      '/login',
      '/:name',
    ]);
  }
}