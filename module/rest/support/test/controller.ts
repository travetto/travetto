import { Readable } from 'node:stream';

import { Controller } from '../../src/decorator/controller';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint';
import { PathParam, QueryParam } from '../../src/decorator/param';
import { HttpRequest, HttpResponse } from '../../src/types';
import { Produces, SetHeaders } from '../../src/decorator/common';
import { Renderable } from '../../src/response/renderable';

@Controller('/test')
export class TestController {
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
  withBody(req: HttpRequest) {
    return { body: req.body.age };
  }

  @Delete('/cookie')
  withCookie(req: HttpRequest, res: HttpResponse) {
    res.cookies.set('flavor', 'oreo');
    return { cookie: req.cookies.get('orange') };
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
  getFullUrl(req: HttpRequest) {
    return {
      url: req.url,
      path: req.path
    };
  }

  @Get('/headerFirst')
  getHeaderFirst(req: HttpRequest) {
    return {
      header: req.headerFirst('age')
    };
  }

  @Post('/rawBody')
  postRawBody(req: HttpRequest) {
    return {
      size: req.raw?.length
    };
  }

  @Get('/fun/*')
  getFun(req: HttpRequest) {
    return {
      path: req.url.split('fun/')[1]
    };
  }

  @Get('/ip')
  getIp(req: HttpRequest) {
    return {
      ip: req.getIp()
    };
  }
}