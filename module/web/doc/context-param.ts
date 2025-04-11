import { CacheControl, ContextParam, Controller, Get, WebRequest, WebResponse } from '@travetto/web';

@Controller('/context')
class ContextController {

  @ContextParam()
  req: WebRequest;

  /**
   * Gets the ip of the user, ensure no caching
   */
  @CacheControl(0)
  @Get('/ip')
  async getIp() {
    return new WebResponse({
      body: { ip: this.req.getIp() },
      headers: {
        'Content-Type': 'application/json+ip'
      }
    });
  }
}