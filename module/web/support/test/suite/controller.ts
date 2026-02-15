import { RuntimeError, BinaryUtil, castTo, CodecUtil } from '@travetto/runtime';

import { Controller } from '../../../src/decorator/controller.ts';
import { Get, Post, Put, Delete, Patch } from '../../../src/decorator/endpoint.ts';
import { ContextParam, PathParam, QueryParam } from '../../../src/decorator/param.ts';
import { Produces, SetHeaders } from '../../../src/decorator/common.ts';

import type { WebRequest } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import type { CookieJar } from '../../../src/util/cookie.ts';

@Controller('/test')
export class TestController {

  @ContextParam()
  request: WebRequest;

  @ContextParam()
  cookies: CookieJar;

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
    return { body: castTo<{ age: number }>(this.request.body).age };
  }

  @Delete('/cookie')
  withCookie() {
    this.cookies.set({ name: 'flavor', value: 'oreo' });
    return new WebResponse({ body: { cookie: this.cookies.get('orange') } });
  }

  @Patch('/regexp/super-:special-party')
  withRegexp(@PathParam() special: string) {
    return { path: special };
  }

  @Get('/stream')
  @SetHeaders({ 'Content-Type': 'text/plain' })
  getStream() {
    return BinaryUtil.toBinaryStream(CodecUtil.fromUTF8String('hello'));
  }

  @Get('/buffer')
  @Produces('text/plain')
  getBuffer() {
    return CodecUtil.fromUTF8String('hello');
  }

  @Get('/renderable')
  @Produces('text/plain')
  getRenderable(): WebResponse<string> {
    return new WebResponse({ body: 'hello' });
  }

  @Get('/fullUrl')
  getFullUrl() {
    return {
      path: this.request.context.path
    };
  }

  @Get('/headerFirst')
  getHeaderFirst() {
    return { header: this.request.headers.get('Age')?.split(',')?.[0] };
  }

  @Get('/fun/*')
  getFun() {
    return { path: this.request.context.path.split('fun/')[1] };
  }

  @Get('/ip')
  getIp() {
    return { ip: this.request.context.connection?.ip };
  }

  @Post('/ip')
  notFound() {
    throw new RuntimeError('Uh-oh', { category: 'general' });
  }
}