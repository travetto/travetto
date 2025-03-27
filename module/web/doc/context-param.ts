import { CacheControl, ContextParam, Controller, Get, HttpRequest, SetHeaders } from '@travetto/web';

@Controller('/context')
class ContextController {

  @ContextParam()
  req: HttpRequest;

  /**
   * Gets the ip of the user, ensure no caching
   */
  @CacheControl(0)
  @Get('/ip')
  @SetHeaders({ 'Content-Type': 'application/json+ip' })
  async getIp() {
    return { ip: this.req.getIp() };
  }
}