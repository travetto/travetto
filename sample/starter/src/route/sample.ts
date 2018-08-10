import { Request } from 'express';
import { Get, Post, Controller, Cache } from '@travetto/express';
import { Injectable } from '@travetto/di';

@Injectable()
class UserService {
  private count = 0;

  getMessage(): any {
    return {
      message: 'Hello world',
      count: this.count++
    };
  }
}

/**
 * Some sample routes, for posterity
 */
@Controller('/sample')
class SampleRoute {

  constructor(private service: UserService) { }

  /**
   * Caching message
   */
  @Get('/hello')
  @Cache(1, 'd')
  async get(req: Request): Promise<String> {
    const res = await this.service.getMessage();
    return res;
  }

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(req: Request): Promise<Object> {
    return req.body;
  }
}