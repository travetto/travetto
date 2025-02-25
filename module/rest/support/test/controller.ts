import { Readable } from 'node:stream';

import { Controller } from '../../src/decorator/controller.ts';
import { Get, Post, Put, Delete, Patch } from '../../src/decorator/endpoint.ts';
import { PathParam, QueryParam } from '../../src/decorator/param.ts';
import { Request, Response } from '../../src/types.ts';
import { Produces, SetHeaders } from '../../src/decorator/common.ts';
import { Renderable } from '../../src/response/renderable.ts';

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
  withBody(req: Request) {
    return { body: req.body.age };
  }

  @Delete('/cookie')
  withCookie(req: Request, res: Response) {
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
  getFullUrl(req: Request) {
    return {
      url: req.url,
      path: req.path
    };
  }

  @Get('/headerFirst')
  getHeaderFirst(req: Request) {
    return {
      header: req.headerFirst('age')
    };
  }

  @Post('/rawBody')
  postRawBody(req: Request) {
    return {
      size: req.raw?.length
    };
  }

  @Get('/fun/*')
  getFun(req: Request) {
    return {
      path: req.url.split('fun/')[1]
    };
  }

  @Get('/ip')
  getIp(req: Request) {
    return {
      ip: req.getIp()
    };
  }
}