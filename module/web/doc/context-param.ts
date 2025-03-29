import { CacheControl, ContextParam, Controller, Get, HttpRequest, HttpResponse } from '@travetto/web';

@Controller('/context')
class ContextController {

  @ContextParam()
  req: HttpRequest;

  /**
   * Gets the ip of the user, ensure no caching
   */
  @CacheControl(0)
  @Get('/ip')
  async getIp() {
    return HttpResponse.from({ ip: this.req.getIp() }).with({
      headers: {
        'Content-Type': 'application/json+ip'
      }
    });
  }
}