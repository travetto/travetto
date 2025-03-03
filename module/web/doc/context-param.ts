import { CacheControl, ContextParam, Controller, Get, HttpRequest, HttpResponse, Post } from '@travetto/web';

@Controller('/context')
class ContextController {

  @ContextParam()
  req: HttpRequest;

  @ContextParam()
  res: HttpResponse;

  /**
   * Gets the ip of the user, ensure no caching
   */
  @CacheControl(0)
  @Get('/ip')
  async getIp() {
    this.res.setHeader('Content-Type', 'application/json');
    this.res.send(JSON.stringify({
      ip: this.req.getIp()
    }));
  }
}