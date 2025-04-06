import { Readable } from 'node:stream';

import { AppError } from '@travetto/runtime';

import { Controller } from '../../../src/decorator/controller.ts';
import { Get, Post, Put, Delete, Patch } from '../../../src/decorator/endpoint.ts';
import { ContextParam, PathParam, QueryParam } from '../../../src/decorator/param.ts';
import { Produces, SetHeaders } from '../../../src/decorator/common.ts';

import { WebRequest } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';

@Controller('/test')
export class TestController {

  @ContextParam()
  req: WebRequest;

  @Get('/json')
  getJSON() {
    return { json: true };
  }

  @Get('/json/large/:size')
  getJSONLarge(size = 20000) {
    return { json: '0123456789'.repeat(size / 10) };
  }

  @Post('/param/:param')
  withParam(@PathParam() param: string) {
    return { param };
  }

  @Put('/query')
  withQuery(@QueryParam() age: number) {
    return { query: age };
  }

  @Put('/body')
  withBody() {
    return { body: this.req.body?.age };
  }

  @Delete('/cookie')
  withCookie() {
    return WebResponse.from({ cookie: this.req.getCookie!('orange') })
      .with({
        cookies: [{ name: 'flavor', value: 'oreo' }]
      });
  }

  @Patch('/regexp/super-:special-party')
  withRegexp(@PathParam() special: string) {
    return { path: special };
  }

  @Get('/stream')
  @SetHeaders({ 'Content-Type': 'text/plain' })
  getStream() {
    return Readable.from(Buffer.from('hello'));
  }

  @Get('/buffer')
  @Produces('text/plain')
  getBuffer() {
    return Buffer.from('hello');
  }

  @Get('/renderable')
  @Produces('text/plain')
  getRenderable(): WebResponse<string> {
    return WebResponse.from('hello');
  }

  @Get('/fullUrl')
  getFullUrl() {
    return {
      path: this.req.path
    };
  }

  @Get('/headerFirst')
  getHeaderFirst() {
    return { header: this.req.headers.get('Age')?.split(',')?.[0] };
  }

  @Get('/fun/*')
  getFun() {
    return { path: this.req.path.split('fun/')[1] };
  }

  @Get('/ip')
  getIp() {
    return { ip: this.req.getIp() };
  }

  @Post('/ip')
  notFound() {
    throw new AppError('Uh-oh', { category: 'general' });
  }
}