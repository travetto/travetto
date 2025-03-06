import { Readable } from 'node:stream';

import { Controller } from '../../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint';
import { ContextParam, PathParam, QueryParam } from '../../src/decorator/param';
import { HttpRequest, HttpResponse } from '../../src/types';
import { Produces, SetHeaders } from '../../src/decorator/common';
import { Renderable } from '../../src/response/renderable';

@Controller('/test')
export class TestController {

  @ContextParam()
  req: HttpRequest;

  @ContextParam()
  res: HttpResponse;

  @Get('/json')
  getJSON() {
    return { json: true };
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
    return { body: this.req.body.age };
  }

  @Delete('/cookie')
  withCookie() {
    this.res.cookies.set('flavor', 'oreo');
    return { cookie: this.req.cookies.get('orange') };
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
  getRenderable(): Renderable {
    return {
      /**
       * @returns {string}
       */
      render(res) {
        return res.send('hello');
      }
    };
  }

  @Get('/fullUrl')
  getFullUrl() {
    return {
      url: this.req.url,
      path: this.req.path
    };
  }

  @Get('/headerFirst')
  getHeaderFirst() {
    return { header: this.req.headerFirst('age') };
  }

  @Post('/rawBody')
  postRawBody() {
    return { size: this.req.raw?.length };
  }

  @Get('/fun/*')
  getFun() {
    return { path: this.req.url.split('fun/')[1] };
  }

  @Get('/ip')
  getIp() {
    return { ip: this.req.getIp() };
  }
}